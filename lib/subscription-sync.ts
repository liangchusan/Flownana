import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { getPriceKeyFromStripePriceId } from "@/lib/plans";
import { getStripe } from "@/lib/stripe";
import { assertUpgradeConsumption } from "@/lib/upgrade-consumption";
import { withBillingUser, type BillingUser } from "@/lib/billing-transaction";
import { BillingOwnershipError, getSubscriptionOwnershipError, isTerminalSubscription, stripeObjectId } from "./stripe-billing-policy.ts";

export const BILLING_READ_OPTIONS = { timeout: 8_000, maxNetworkRetries: 0 } as const;

export async function verifySubscriptionOwnership(user: BillingUser, sub: Stripe.Subscription): Promise<void> {
  let originCreatedAt: number | undefined;
  if (!sub.metadata.accountCreatedAt && !user.stripeCustomerId && sub.metadata.userId === user.id &&
    sub.created * 1000 >= user.createdAt.getTime()) {
    const sessions = await getStripe().checkout.sessions.list(
      { subscription: sub.id, limit: 10 }, BILLING_READ_OPTIONS
    );
    if (sessions.data.length === 0) {
      // Invoice delivery can precede visibility of the originating Checkout.
      // Missing evidence is retryable, not proof of a deleted account.
      throw new Error("Originating Checkout is not yet available");
    }
    const origin = sessions.data.find((session) =>
      session.mode === "subscription" && stripeObjectId(session.subscription) === sub.id &&
      stripeObjectId(session.customer) === stripeObjectId(sub.customer) &&
      (session.client_reference_id || session.metadata?.userId) === user.id &&
      (!session.metadata?.accountCreatedAt || session.metadata.accountCreatedAt === user.createdAt.toISOString())
    );
    originCreatedAt = origin?.created;
  }
  const error = getSubscriptionOwnershipError(user, sub, originCreatedAt);
  if (error) throw new BillingOwnershipError(error);
}

export async function syncSubscriptionRecord(
  tx: Prisma.TransactionClient,
  user: BillingUser,
  sub: Stripe.Subscription
) {
  await verifySubscriptionOwnership(user, sub);
  if (!isTerminalSubscription(sub.status)) await assertUpgradeConsumption(tx, user, sub);
  const stripePriceId = sub.items.data[0]?.price.id;
  const parsed = stripePriceId ? getPriceKeyFromStripePriceId(stripePriceId) : null;
  if (!parsed || sub.items.data.length !== 1) throw new Error("Unknown subscription price");
  const start = new Date(sub.current_period_start * 1000);
  const end = new Date(sub.current_period_end * 1000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw new Error("Invalid subscription period");
  }
  const existing = await tx.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
  if (existing && existing.userId !== user.id) throw new Error("Subscription owner mismatch");
  // Cancellation is terminal for a Stripe subscription ID. Even a stale read
  // cannot resurrect it, or move a locally recorded period backwards.
  if (existing && (isTerminalSubscription(existing.status) || start < existing.currentPeriodStart)) {
    if (isTerminalSubscription(existing.status) && existing.nextCreditAt) {
      return tx.subscription.update({ where: { id: existing.id }, data: { nextCreditAt: null } });
    }
    return existing;
  }
  const data = {
    stripePriceId, planType: parsed.plan, billingCycle: parsed.billing,
    status: sub.status, currentPeriodStart: start, currentPeriodEnd: end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    ...((isTerminalSubscription(sub.status) || parsed.billing !== "yearly" ||
      (existing && existing.currentPeriodStart.getTime() !== start.getTime()))
      ? { nextCreditAt: null } : {}),
  };
  return tx.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: { userId: user.id, stripeSubscriptionId: sub.id, ...data },
    update: data,
  });
}

export async function upsertSubscriptionFromStripe(params: {
  userId: string;
  stripeSubscription: Stripe.Subscription;
  stripePriceId: string;
}): Promise<void> {
  await withBillingUser(params.userId, async (tx, user) => {
    // Event snapshots are only identifiers. Read Stripe while holding the
    // common lock, so a delayed handler cannot overwrite a newer local state.
    const fresh = await getStripe().subscriptions.retrieve(
      params.stripeSubscription.id, {}, BILLING_READ_OPTIONS
    );
    await syncSubscriptionRecord(tx, user, fresh);
  });
}

export { addMonthsClamped as addMonths } from "./yearly-credit-schedule.ts";
