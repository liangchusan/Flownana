import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { PLAN_CREDITS, getPriceKeyFromStripePriceId, isUpgradeAllowed } from "@/lib/plans";
import { getStripe } from "@/lib/stripe";
import { claimUpgradeConsumption } from "@/lib/upgrade-consumption";
import { expirePredecessorCheckout, settleCheckoutReservation } from "@/lib/checkout-reservation";
import { withBillingUser, type BillingUser } from "@/lib/billing-transaction";
import { BILLING_READ_OPTIONS, syncSubscriptionRecord, verifySubscriptionOwnership } from "@/lib/subscription-sync";
import {
  isPaidInvoiceForSubscriptionPeriod, stripeObjectId,
} from "./stripe-billing-policy.ts";
import {
  addMonthsClamped, getDueYearlyCreditGrantDates, getUnissuedYearlyCreditDates,
  getNextYearlyCreditAt, getYearlyCreditGrantKey,
} from "./yearly-credit-schedule.ts";

const MS_PER_DAY = 86_400_000;

export async function readPaidPeriodInvoice(
  stripe: Stripe, invoiceId: string, sub: Stripe.Subscription
): Promise<Stripe.Invoice | null> {
  const invoice = await stripe.invoices.retrieve(invoiceId, {}, BILLING_READ_OPTIONS);
  if (invoice.lines.has_more) {
    // Inspect the whole invoice, not just Stripe's first embedded page.
    invoice.lines.data = await stripe.invoices.listLineItems(
      invoiceId, { limit: 100 }, BILLING_READ_OPTIONS
    ).autoPagingToArray({ limit: 1_000 });
  }
  return isPaidInvoiceForSubscriptionPeriod(invoice, sub) ? invoice : null;
}

async function cancelUpgradePredecessor(
  stripe: Stripe, tx: Prisma.TransactionClient, user: BillingUser, sub: Stripe.Subscription
) {
  const previousId = sub.metadata.upgradeFromSubscriptionId;
  if (!previousId) return;
  if (previousId === sub.id) throw new Error("Invalid upgrade predecessor");
  let previous = await stripe.subscriptions.retrieve(previousId, {}, BILLING_READ_OPTIONS);
  await verifySubscriptionOwnership(user, previous);
  if (previous.status !== "canceled") {
    const oldPlan = getPriceKeyFromStripePriceId(previous.items.data[0]?.price.id ?? "");
    const newPlan = getPriceKeyFromStripePriceId(sub.items.data[0]?.price.id ?? "");
    if (!oldPlan || !newPlan || !isUpgradeAllowed(oldPlan.key, newPlan.key)) {
      throw new Error("Invalid upgrade direction");
    }
    try {
      previous = await stripe.subscriptions.cancel(
        previousId, { prorate: false }, BILLING_READ_OPTIONS
      );
    } catch (error) {
      // A timed-out cancellation may already have succeeded remotely.
      previous = await stripe.subscriptions.retrieve(previousId, {}, BILLING_READ_OPTIONS);
      if (previous.status !== "canceled") throw error;
    }
  }
  // A completed upgrade remains complete if a later paid renewal follows a
  // Billing Portal downgrade. Its historic predecessor is already terminal.
  if (previous.status !== "canceled") throw new Error("Upgrade cancellation is pending");
  await syncSubscriptionRecord(tx, user, previous);
}

export async function grantCreditsForCurrentPeriodIfNeeded(params: {
  userId: string;
  sub: Pick<Stripe.Subscription, "id">;
  invoiceId: string;
  source: string;
  expectedAccountCreatedAt?: string;
  expectedCustomerId?: string;
}): Promise<boolean> {
  return withBillingUser(params.userId, async (tx, user) => {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(params.sub.id, {}, BILLING_READ_OPTIONS);
    if (params.expectedCustomerId && stripeObjectId(sub.customer) !== params.expectedCustomerId) {
      throw new Error("Checkout customer does not match subscription");
    }
    const record = await syncSubscriptionRecord(tx, user, sub);
    if (!["active", "trialing"].includes(record.status) ||
      record.currentPeriodStart.getTime() !== sub.current_period_start * 1000) return false;
    if (!await readPaidPeriodInvoice(stripe, params.invoiceId, sub)) return false;
    const grantKey = `grant_sub_${sub.id}_${sub.current_period_start}`;
    const alreadyGranted = await tx.processedStripeEvent.findUnique({ where: { id: grantKey } });
    if (!alreadyGranted) await expirePredecessorCheckout(tx, user, stripe, sub.id);
    const parsed = getPriceKeyFromStripePriceId(record.stripePriceId);
    if (!parsed) throw new Error("Unknown subscription price");

    // invoice.paid can arrive before checkout.session.completed. Both paths
    // must finish cancellation before granting the new subscription's credits.
    await settleCheckoutReservation(tx, user, stripe, sub);
    await claimUpgradeConsumption(tx, user, stripe, sub);
    await cancelUpgradePredecessor(stripe, tx, user, sub);
    if (!user.stripeCustomerId) {
      await tx.user.update({ where: { id: user.id }, data: { stripeCustomerId: stripeObjectId(sub.customer) } });
    }
    if (alreadyGranted) return false;
    await tx.processedStripeEvent.create({ data: { id: grantKey, type: "subscription_period_grant" } });
    const amount = PLAN_CREDITS[parsed.plan];
    await tx.creditBatch.create({ data: {
      userId: user.id, amount, remaining: amount,
      expiresAt: new Date(Date.now() + 30 * MS_PER_DAY), source: params.source,
    } });
    await tx.subscription.update({
      where: { id: record.id },
      data: { nextCreditAt: parsed.billing === "yearly"
        ? addMonthsClamped(record.currentPeriodStart, 1) : null },
    });
    return true;
  }, params.expectedAccountCreatedAt);
}

export async function grantDueYearlyCredits(params: {
  userId: string; stripeSubscriptionId: string; now: Date;
}): Promise<{ granted: number; duplicates: number }> {
  return withBillingUser(params.userId, async (tx, user) => {
    const stripe = getStripe();
    const fresh = await stripe.subscriptions.retrieve(params.stripeSubscriptionId, {}, BILLING_READ_OPTIONS);
    const sub = await syncSubscriptionRecord(tx, user, fresh);
    const parsed = getPriceKeyFromStripePriceId(sub.stripePriceId);
    if (!parsed || parsed.billing !== "yearly" || !["active", "trialing"].includes(sub.status) ||
      !sub.nextCreditAt || sub.currentPeriodStart.getTime() !== fresh.current_period_start * 1000) {
      return { granted: 0, duplicates: 0 };
    }
    const invoiceId = stripeObjectId(fresh.latest_invoice);
    if (!invoiceId || !await readPaidPeriodInvoice(stripe, invoiceId, fresh)) {
      throw new Error("Annual period has no matching paid invoice");
    }
    const firstGrant = await tx.processedStripeEvent.findUnique({
      where: { id: `grant_sub_${fresh.id}_${fresh.current_period_start}` },
    });
    if (!firstGrant) throw new Error("Annual period initial grant has not completed");
    const dueDates = getDueYearlyCreditGrantDates({ ...sub, now: params.now });
    if (dueDates.length) await expirePredecessorCheckout(tx, user, stripe, fresh.id);
    let granted = 0;
    let duplicates = 0;
    for (const dueDate of dueDates) {
      const grantKey = getYearlyCreditGrantKey(sub.id, dueDate);
      if (await tx.processedStripeEvent.findUnique({ where: { id: grantKey } })) {
        duplicates += 1;
      } else {
        await tx.processedStripeEvent.create({ data: { id: grantKey, type: "yearly_monthly_credit_grant" } });
        const amount = PLAN_CREDITS[parsed.plan];
        await tx.creditBatch.create({ data: {
          userId: user.id, amount, remaining: amount,
          expiresAt: new Date(Date.now() + 30 * MS_PER_DAY), source: "yearly_monthly_cron",
        } });
        granted += 1;
      }
      await tx.subscription.update({ where: { id: sub.id }, data: {
        nextCreditAt: getNextYearlyCreditAt({
          lastDueCreditAt: dueDate, currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
        }),
      } });
    }
    if (!dueDates.length && !getUnissuedYearlyCreditDates(sub).length) {
      await tx.subscription.update({ where: { id: sub.id }, data: { nextCreditAt: null } });
    }
    return { granted, duplicates };
  });
}
