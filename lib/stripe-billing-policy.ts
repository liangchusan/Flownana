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

type ModernInvoice = {
  parent?: {
    type?: string;
    subscription_details?: {
      subscription?: string | { id: string } | null;
    } | null;
  } | null;
};

type ModernInvoiceLine = {
  parent?: {
    type?: string;
    subscription_item_details?: {
      proration?: boolean;
      subscription?: string | { id: string } | null;
      subscription_item?: string | { id: string } | null;
    } | null;
  } | null;
  pricing?: {
    price_details?: {
      price?: string | { id: string } | null;
    } | null;
  } | null;
};

/** Stripe 2026-01-28 moved an invoice's subscription under `parent`. */
export function stripeInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = stripeObjectId(invoice.subscription);
  if (legacy) return legacy;
  const parent = (invoice as unknown as ModernInvoice).parent;
  return parent?.type === "subscription_details"
    ? stripeObjectId(parent.subscription_details?.subscription)
    : null;
}

function paidSubscriptionLineMatches(
  line: Stripe.InvoiceLineItem,
  sub: Pick<Stripe.Subscription, "id" | "items" | "current_period_start" | "current_period_end">
): boolean {
  const item = sub.items.data[0];
  const modern = line as unknown as ModernInvoiceLine;
  const details = modern.parent?.type === "subscription_item_details"
    ? modern.parent.subscription_item_details
    : null;
  const subscriptionId = stripeObjectId(line.subscription) ?? stripeObjectId(details?.subscription);
  const subscriptionItemId = stripeObjectId(line.subscription_item) ?? stripeObjectId(details?.subscription_item);
  const priceId = line.price?.id ?? stripeObjectId(modern.pricing?.price_details?.price);
  const isSubscriptionLine = line.type === "subscription" || details !== null;
  const isProration = details ? details.proration : line.proration;

  return isSubscriptionLine && isProration === false &&
    subscriptionId === sub.id && subscriptionItemId === item.id &&
    priceId === item.price.id && line.quantity === 1 &&
    line.period.start === sub.current_period_start &&
    line.period.end === sub.current_period_end;
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
    stripeInvoiceSubscriptionId(invoice as Stripe.Invoice) !== sub.id ||
    stripeObjectId(invoice.customer) !== stripeObjectId(sub.customer) ||
    sub.items.data.length !== 1) return false;
  return invoice.lines.data.some((line) => paidSubscriptionLineMatches(line, sub));
}

export function isTerminalSubscription(status: string): boolean {
  return status === "canceled" || status === "incomplete_expired";
}
