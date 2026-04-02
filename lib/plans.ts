export type PlanKey = "pro" | "max";
export type BillingKey = "monthly" | "yearly";
export type PriceKey =
  | "pro_monthly"
  | "pro_yearly"
  | "max_monthly"
  | "max_yearly";

export const PLAN_CREDITS: Record<PlanKey, number> = {
  pro: 200,
  max: 800,
};

export const PLAN_RESOLUTION: Record<PlanKey, string> = {
  pro: "720P",
  max: "1080P",
};

export const PLAN_DISPLAY: Record<
  PriceKey,
  { plan: PlanKey; billing: BillingKey; label: string }
> = {
  pro_monthly: { plan: "pro", billing: "monthly", label: "Pro Monthly" },
  pro_yearly: { plan: "pro", billing: "yearly", label: "Pro Yearly" },
  max_monthly: { plan: "max", billing: "monthly", label: "Max Monthly" },
  max_yearly: { plan: "max", billing: "yearly", label: "Max Yearly" },
};

export function getStripePriceId(key: PriceKey): string {
  const envMap: Record<PriceKey, string | undefined> = {
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    max_monthly: process.env.STRIPE_PRICE_MAX_MONTHLY,
    max_yearly: process.env.STRIPE_PRICE_MAX_YEARLY,
  };
  const id = envMap[key];
  if (!id) {
    throw new Error(`Missing Stripe price env for ${key}`);
  }
  return id;
}

export function getPriceKeyFromStripePriceId(
  priceId: string
): { key: PriceKey; plan: PlanKey; billing: BillingKey } | null {
  const entries: [PriceKey, string | undefined][] = [
    ["pro_monthly", process.env.STRIPE_PRICE_PRO_MONTHLY],
    ["pro_yearly", process.env.STRIPE_PRICE_PRO_YEARLY],
    ["max_monthly", process.env.STRIPE_PRICE_MAX_MONTHLY],
    ["max_yearly", process.env.STRIPE_PRICE_MAX_YEARLY],
  ];
  for (const [key, id] of entries) {
    if (id && id === priceId) {
      const meta = PLAN_DISPLAY[key];
      return { key, plan: meta.plan, billing: meta.billing };
    }
  }
  return null;
}
