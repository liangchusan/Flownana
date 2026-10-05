import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getPriceKeyFromStripePriceId } from "@/lib/plans";
import { stripeInvoiceSubscriptionId, stripeObjectId, getSubscriptionOwnershipError } from "@/lib/stripe-billing-policy";
import { commerceEvent } from "./analytics-policy";
import { getAccountAnalyticsContext, queueAnalyticsReport, serverMeasurementId } from "@/lib/analytics-server";

// Pure payload policy, after remote retrieval and ownership verification.
export function verifiedInvoiceEvent(invoice: Stripe.Invoice, intent: Stripe.PaymentIntent | null, priceKey: string, purchaseType: string) {
  if (invoice.status !== "paid" || !invoice.paid || !intent || intent.status !== "succeeded" ||
    intent.amount_received <= 0 || invoice.amount_paid <= 0 || intent.amount_received !== invoice.amount_paid ||
    stripeObjectId(invoice.payment_intent) !== intent.id || stripeObjectId(intent.customer) !== stripeObjectId(invoice.customer) ||
    intent.currency !== invoice.currency || intent.livemode !== invoice.livemode ||
    (invoice as Stripe.Invoice & { paid_out_of_band?: boolean }).paid_out_of_band ||
    invoice.total_excluding_tax === null || invoice.total_excluding_tax < 0) return null;
  const event = commerceEvent(priceKey, invoice.total_excluding_tax, invoice.currency);
  if (!event) return null;
  return { ...event, transaction_id: invoice.id, tax: (invoice.total - invoice.total_excluding_tax) / 100, purchase_type: purchaseType };
}

export async function reportVerifiedInvoice(invoiceId: string, expectedUserId?: string) {
  if (!serverMeasurementId()) return;
  const stripe = getStripe();
  const readOptions = { timeout: 8_000, maxNetworkRetries: 0 } as const;
  const invoice = await stripe.invoices.retrieve(invoiceId, {}, readOptions);
  if (invoice.livemode !== (process.env.VERCEL_ENV === "production")) throw new Error("Analytics invoice environment mismatch");
  const subId = stripeInvoiceSubscriptionId(invoice);
  if (!subId) return;
  const sub = await stripe.subscriptions.retrieve(subId, {}, readOptions);
  if (sub.livemode !== invoice.livemode || stripeObjectId(invoice.customer) !== stripeObjectId(sub.customer)) throw new Error("Analytics invoice binding mismatch");
  const userId = sub.metadata.userId;
  if (!userId || (expectedUserId && userId !== expectedUserId)) throw new Error("Analytics invoice account mismatch");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || getSubscriptionOwnershipError(user, sub)) throw new Error("Analytics subscription ownership mismatch");
  if (invoice.lines.has_more) invoice.lines.data = await stripe.invoices.listLineItems(invoiceId, { limit: 100 }, readOptions).autoPagingToArray({ limit: 1000 });
  // This MVP sells one plan per invoice. Ambiguous/mixed invoices are a coverage gap, never guessed.
  const lines = invoice.lines.data.filter(line => line.amount !== 0);
  if (lines.length !== 1 || lines[0].quantity !== 1) return;
  const plan = getPriceKeyFromStripePriceId(lines[0].price?.id || "");
  if (!plan) return;
  const intentId = stripeObjectId(invoice.payment_intent);
  const intent = intentId ? await stripe.paymentIntents.retrieve(intentId, {}, readOptions) : null;
  const purchaseType = invoice.billing_reason === "subscription_cycle" ? "renewal" : sub.metadata.upgradeFromSubscriptionId ? "upgrade" : "new_subscription";
  const params = verifiedInvoiceEvent(invoice, intent, plan.key, purchaseType);
  if (!params) return;
  const occurredAt = new Date((invoice.status_transitions.paid_at || invoice.created) * 1000);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const current = await tx.user.findUnique({ where: { id: userId } });
    if (!current || current.createdAt.getTime() !== user.createdAt.getTime()) throw new Error("Analytics account changed");
    const reservation = sub.metadata.checkoutReservationId ? await tx.checkoutReservation.findUnique({ where: { id: sub.metadata.checkoutReservationId } }) : null;
    const context = reservation?.stripeSessionId && invoice.billing_reason !== "subscription_cycle"
      ? await getAccountAnalyticsContext(tx, userId, `checkout:${reservation.stripeSessionId}`)
      : await getAccountAnalyticsContext(tx, userId);
    await queueAnalyticsReport(tx, { userId, key: invoice.id, name: "purchase", params, context, occurredAt });
  });
}
