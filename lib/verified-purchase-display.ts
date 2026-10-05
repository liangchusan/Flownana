export type VerifiedPurchase = {
  transactionId: string;
  purchaseType: "new_subscription" | "upgrade";
  to: string;
  payableCents: number;
  creditCents: number;
  currency: string;
};
