export type StripeStateSyncKind = "subscription" | "invoice" | null;

const SUBSCRIPTION_STATE_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

const INVOICE_STATE_EVENTS = new Set([
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.finalization_failed",
]);

export function getStripeStateSyncKind(
  eventType: string
): StripeStateSyncKind {
  if (SUBSCRIPTION_STATE_EVENTS.has(eventType)) {
    return "subscription";
  }
  if (INVOICE_STATE_EVENTS.has(eventType)) {
    return "invoice";
  }
  return null;
}
