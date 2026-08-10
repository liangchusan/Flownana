export type CheckoutCompletionShape = {
  mode: string | null;
  status: string | null;
  paymentStatus: string;
  userId: string | null;
};

export function getCheckoutCompletionError(
  checkout: CheckoutCompletionShape,
  expectedUserId?: string
): string | null {
  if (
    checkout.mode !== "subscription" ||
    checkout.status !== "complete" ||
    checkout.paymentStatus !== "paid"
  ) {
    return "Checkout Session payment is not complete";
  }
  if (!checkout.userId) return "Checkout Session has no user";
  if (expectedUserId && checkout.userId !== expectedUserId) {
    return "Checkout Session does not belong to the signed-in user";
  }
  return null;
}
