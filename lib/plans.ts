export const PLAN_KEYS = ["starter", "pro", "max"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export const BILLING_KEYS = ["monthly", "yearly"] as const;
export type BillingKey = (typeof BILLING_KEYS)[number];

export const PRICE_KEYS = [
  "starter_monthly",
  "starter_yearly",
  "pro_monthly",
  "pro_yearly",
  "max_monthly",
  "max_yearly",
] as const;
export type PriceKey = (typeof PRICE_KEYS)[number];

export type PlanDefinition = {
  name: string;
  credits: number;
  resolution: "720P" | "1080P";
  monthlyPrice: number;
  yearlyPrice: number;
};

export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  starter: {
    name: "Starter",
    credits: 200,
    resolution: "720P",
    monthlyPrice: 16,
    yearlyPrice: 96,
  },
  pro: {
    name: "Pro",
    credits: 800,
    resolution: "1080P",
    monthlyPrice: 48,
    yearlyPrice: 288,
  },
  max: {
    name: "Max",
    credits: 2400,
    resolution: "1080P",
    monthlyPrice: 96,
    yearlyPrice: 576,
  },
};

export const PLAN_CREDITS: Record<PlanKey, number> = {
  starter: PLAN_CATALOG.starter.credits,
  pro: PLAN_CATALOG.pro.credits,
  max: PLAN_CATALOG.max.credits,
};

export const PLAN_RESOLUTION: Record<PlanKey, string> = {
  starter: PLAN_CATALOG.starter.resolution,
  pro: PLAN_CATALOG.pro.resolution,
  max: PLAN_CATALOG.max.resolution,
};

export const PLAN_DISPLAY: Record<
  PriceKey,
  { plan: PlanKey; billing: BillingKey; label: string }
> = {
  starter_monthly: {
    plan: "starter",
    billing: "monthly",
    label: "Starter Monthly",
  },
  starter_yearly: {
    plan: "starter",
    billing: "yearly",
    label: "Starter Yearly",
  },
  pro_monthly: { plan: "pro", billing: "monthly", label: "Pro Monthly" },
  pro_yearly: { plan: "pro", billing: "yearly", label: "Pro Yearly" },
  max_monthly: { plan: "max", billing: "monthly", label: "Max Monthly" },
  max_yearly: { plan: "max", billing: "yearly", label: "Max Yearly" },
};

export const PLAN_TIER: Record<PlanKey, number> = {
  starter: 1,
  pro: 2,
  max: 3,
};

export const ALLOWED_UPGRADES: Record<PriceKey, PriceKey[]> = {
  starter_monthly: [
    "starter_yearly",
    "pro_monthly",
    "pro_yearly",
    "max_monthly",
    "max_yearly",
  ],
  starter_yearly: ["pro_yearly", "max_yearly"],
  pro_monthly: ["pro_yearly", "max_monthly", "max_yearly"],
  pro_yearly: ["max_yearly"],
  max_monthly: ["max_yearly"],
  max_yearly: [],
};

export function isPlanKey(value: string): value is PlanKey {
  return (PLAN_KEYS as readonly string[]).includes(value);
}

export function isPriceKey(value: string): value is PriceKey {
  return (PRICE_KEYS as readonly string[]).includes(value);
}

export function getPriceKey(plan: PlanKey, billing: BillingKey): PriceKey {
  return `${plan}_${billing}` as PriceKey;
}

export function isUpgradeAllowed(
  currentKey: PriceKey,
  targetKey: PriceKey
): boolean {
  return ALLOWED_UPGRADES[currentKey].includes(targetKey);
}

export function isLowerTier(
  targetKey: PriceKey,
  currentKey: PriceKey
): boolean {
  return (
    PLAN_TIER[PLAN_DISPLAY[targetKey].plan] <
    PLAN_TIER[PLAN_DISPLAY[currentKey].plan]
  );
}

export function getExpectedPriceCents(key: PriceKey): number {
  const { plan, billing } = PLAN_DISPLAY[key];
  const definition = PLAN_CATALOG[plan];
  const dollars =
    billing === "monthly"
      ? definition.monthlyPrice
      : definition.yearlyPrice;
  return dollars * 100;
}

type StripePriceShape = {
  active?: boolean;
  currency?: string;
  unit_amount?: number | null;
  recurring?: { interval?: string } | null;
};

export function getStripePriceValidationError(
  key: PriceKey,
  price: StripePriceShape
): string | null {
  const expectedAmount = getExpectedPriceCents(key);
  const expectedInterval =
    PLAN_DISPLAY[key].billing === "monthly" ? "month" : "year";

  if (price.active === false) {
    return `Stripe price for ${key} is inactive.`;
  }
  if (price.currency?.toLowerCase() !== "usd") {
    return `Stripe price for ${key} must use USD.`;
  }
  if (price.unit_amount !== expectedAmount) {
    return `Stripe price for ${key} must be ${expectedAmount} cents.`;
  }
  if (price.recurring?.interval !== expectedInterval) {
    return `Stripe price for ${key} must recur every ${expectedInterval}.`;
  }
  return null;
}

export function assertStripePriceMatchesPlan(
  key: PriceKey,
  price: StripePriceShape
): void {
  const error = getStripePriceValidationError(key, price);
  if (error) throw new Error(error);
}

function getPriceEnvMap(): Record<PriceKey, string | undefined> {
  return {
    starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    starter_yearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    max_monthly: process.env.STRIPE_PRICE_MAX_MONTHLY,
    max_yearly: process.env.STRIPE_PRICE_MAX_YEARLY,
  };
}

export function getStripePriceId(key: PriceKey): string {
  const id = getPriceEnvMap()[key];
  if (!id) {
    throw new Error(`Missing Stripe price env for ${key}`);
  }
  return id;
}

export function getPriceKeyFromStripePriceId(
  priceId: string
): { key: PriceKey; plan: PlanKey; billing: BillingKey } | null {
  const entries = Object.entries(getPriceEnvMap()) as [
    PriceKey,
    string | undefined,
  ][];

  for (const [key, id] of entries) {
    if (id && id === priceId) {
      const meta = PLAN_DISPLAY[key];
      return { key, plan: meta.plan, billing: meta.billing };
    }
  }

  return null;
}
