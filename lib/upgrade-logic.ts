import type Stripe from "stripe";
import {
  assertStripePriceMatchesPlan,
  isUpgradeAllowed,
  PLAN_DISPLAY,
  type PriceKey,
} from "@/lib/plans";
import {
  calculateYearlyUpgradeCreditCents,
  countRemainingMonths,
} from "@/lib/upgrade-proration";

export { isUpgradeAllowed };
export { countRemainingMonths };

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
  assertStripePriceMatchesPlan(params.targetKey, targetPrice);
  const targetAmountCents = targetPrice.unit_amount ?? 0;
  const currency = targetPrice.currency || "usd";

  let remainingMonths = 0;
  let creditAmountCents = 0;

  const currentPlan = PLAN_DISPLAY[params.currentKey];
  const targetPlan = PLAN_DISPLAY[params.targetKey];
  const isYearlyTierUpgrade =
    currentPlan.billing === "yearly" &&
    targetPlan.billing === "yearly" &&
    currentPlan.plan !== targetPlan.plan;

  if (isYearlyTierUpgrade) {
    remainingMonths = countRemainingMonths(
      params.nextCreditAt,
      new Date(params.currentStripeSubscription.current_period_start * 1000),
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

      creditAmountCents = calculateYearlyUpgradeCreditCents({
        currentYearlyAmountCents: currentYearlyAmount,
        remainingMonths,
        targetAmountCents,
      });
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
