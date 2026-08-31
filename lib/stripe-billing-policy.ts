import type Stripe from "stripe";

export class BillingOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingOwnershipError";
  }
}

export function stripeObjectId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

export function getSubscriptionOwnershipError(
  user: { id: string; createdAt: Date; stripeCustomerId: string | null },
  sub: Pick<Stripe.Subscription, "customer" | "metadata" | "created">,
  originCheckoutCreatedAt?: number
): string | null {
  const customer = stripeObjectId(sub.customer);
  if (!customer || (sub.metadata.userId && sub.metadata.userId !== user.id)) {
    return "Subscription does not belong to this account";
  }
  if (user.stripeCustomerId && user.stripeCustomerId !== customer) {
    return "Subscription customer does not match this account";
  }
  const epoch = sub.metadata.accountCreatedAt;
  if (epoch) {
    return epoch === user.createdAt.toISOString() ? null : "Subscription belongs to a previous account";
  }
  // Subscription creation alone is insufficient: an old open Checkout can be
  // paid after deletion/re-registration, creating a brand-new subscription.
  // Preserve known legacy customers, otherwise require the originating Session.
  if (customer !== user.stripeCustomerId &&
    (!sub.metadata.userId || sub.created * 1000 < user.createdAt.getTime() ||
      !Number.isFinite(originCheckoutCreatedAt) ||
      originCheckoutCreatedAt! * 1000 < user.createdAt.getTime())) {
    return "Subscription belongs to a previous or unverified account";
  }
  return null;
}

export function isPaidInvoiceForSubscriptionPeriod(
  invoice: Pick<Stripe.Invoice, "paid" | "status" | "subscription" | "customer" | "lines">,
  sub: Pick<Stripe.Subscription, "id" | "customer" | "items" | "current_period_start" | "current_period_end">
): boolean {
  if (invoice.paid !== true || invoice.status !== "paid" ||
    stripeObjectId(invoice.subscription) !== sub.id ||
    stripeObjectId(invoice.customer) !== stripeObjectId(sub.customer) ||
    sub.items.data.length !== 1) return false;
  const item = sub.items.data[0];
  return invoice.lines.data.some((line) =>
    line.type === "subscription" && line.proration === false &&
    stripeObjectId(line.subscription) === sub.id &&
    stripeObjectId(line.subscription_item) === item.id &&
    line.price?.id === item.price.id && line.quantity === 1 &&
    line.period.start === sub.current_period_start &&
    line.period.end === sub.current_period_end
  );
}

export function isTerminalSubscription(status: string): boolean {
  return status === "canceled" || status === "incomplete_expired";
}
