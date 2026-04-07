import type Stripe from "stripe";
import type { PriceKey } from "@/lib/plans";

export const ALLOWED_UPGRADES: Record<PriceKey, PriceKey[]> = {
  pro_monthly: ["pro_yearly", "max_monthly", "max_yearly"],
  pro_yearly: ["max_yearly"],
  max_monthly: ["max_yearly"],
  max_yearly: [],
};

export function isUpgradeAllowed(currentKey: PriceKey, targetKey: PriceKey): boolean {
  return ALLOWED_UPGRADES[currentKey]?.includes(targetKey) ?? false;
}

export function countRemainingMonths(
  nextCreditAt: Date | null,
  currentPeriodEnd: Date
): number {
  if (!nextCreditAt || nextCreditAt >= currentPeriodEnd) {
    return 0;
  }

  let count = 0;
  let cursor = new Date(nextCreditAt.getTime());
  while (cursor < currentPeriodEnd) {
    count += 1;
    const day = cursor.getDate();
    cursor.setMonth(cursor.getMonth() + 1);
    if (cursor.getDate() < day) {
      cursor.setDate(0);
    }
  }
  return count;
}

export async function buildUpgradeQuote(params: {
  stripe: Stripe;
  currentKey: PriceKey;
  currentStripePriceId: string;
  currentStripeSubscription: Stripe.Subscription;
  targetKey: PriceKey;
  targetPriceId: string;
  nextCreditAt: Date | null;
  currentPeriodEnd: Date;
}): Promise<{
  currency: string;
  targetAmountCents: number;
  creditAmountCents: number;
  payableAmountCents: number;
  remainingMonths: number;
}> {
  const targetPrice = await params.stripe.prices.retrieve(params.targetPriceId);
  const targetAmountCents = targetPrice.unit_amount ?? 0;
  const currency = targetPrice.currency || "usd";

  let remainingMonths = 0;
  let creditAmountCents = 0;

  if (params.currentKey === "pro_yearly" && params.targetKey === "max_yearly") {
    remainingMonths = countRemainingMonths(
      params.nextCreditAt,
      params.currentPeriodEnd
    );

    if (remainingMonths > 0) {
      let currentYearlyAmount =
        params.currentStripeSubscription.items.data[0]?.price?.unit_amount ?? null;
      if (!currentYearlyAmount) {
        const currentPrice = await params.stripe.prices.retrieve(
          params.currentStripePriceId
        );
        currentYearlyAmount = currentPrice.unit_amount;
      }

      const rawCredit = currentYearlyAmount
        ? Math.floor(currentYearlyAmount / 12) * remainingMonths
        : 0;
      creditAmountCents = Math.min(rawCredit, Math.max(targetAmountCents - 1, 0));
    }
  }

  return {
    currency,
    targetAmountCents,
    creditAmountCents,
    payableAmountCents: Math.max(targetAmountCents - creditAmountCents, 0),
    remainingMonths,
  };
}
