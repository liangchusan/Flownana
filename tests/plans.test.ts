import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLOWED_UPGRADES,
  getExpectedPriceCents,
  getPriceKeyFromStripePriceId,
  getStripePriceValidationError,
  isPriceKey,
  isUpgradeAllowed,
  PLAN_CATALOG,
  PRICE_KEYS,
} from "../lib/plans.ts";

test("plan catalog matches the approved Starter, Pro, and Max offer", () => {
  assert.deepEqual(PLAN_CATALOG, {
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
  });
});

test("price amounts match monthly and 50%-off yearly billing", () => {
  assert.deepEqual(
    Object.fromEntries(PRICE_KEYS.map((key) => [key, getExpectedPriceCents(key)])),
    {
      starter_monthly: 1600,
      starter_yearly: 9600,
      pro_monthly: 4800,
      pro_yearly: 28800,
      max_monthly: 9600,
      max_yearly: 57600,
    }
  );
});

test("upgrade matrix permits only forward paths", () => {
  assert.deepEqual(ALLOWED_UPGRADES, {
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
  });

  for (const current of PRICE_KEYS) {
    for (const target of PRICE_KEYS) {
      assert.equal(
        isUpgradeAllowed(current, target),
        ALLOWED_UPGRADES[current].includes(target),
        `${current} -> ${target}`
      );
    }
  }
});

test("Stripe price validation blocks mismatched amount, currency, and interval", () => {
  assert.equal(
    getStripePriceValidationError("pro_yearly", {
      active: true,
      currency: "usd",
      unit_amount: 28800,
      recurring: { interval: "year" },
    }),
    null
  );
  assert.match(
    getStripePriceValidationError("pro_yearly", {
      active: true,
      currency: "usd",
      unit_amount: 30000,
      recurring: { interval: "year" },
    }) || "",
    /28800 cents/
  );
  assert.match(
    getStripePriceValidationError("max_monthly", {
      active: true,
      currency: "eur",
      unit_amount: 9600,
      recurring: { interval: "month" },
    }) || "",
    /USD/
  );
  assert.match(
    getStripePriceValidationError("starter_monthly", {
      active: true,
      currency: "usd",
      unit_amount: 1600,
      recurring: { interval: "year" },
    }) || "",
    /every month/
  );
  assert.equal(isPriceKey("starter_yearly"), true);
  assert.equal(isPriceKey("enterprise_monthly"), false);
});

test("configured Stripe prices map to the current plan entitlements", () => {
  const originalStarter = process.env.STRIPE_PRICE_STARTER_MONTHLY;
  const originalMax = process.env.STRIPE_PRICE_MAX_YEARLY;

  try {
    process.env.STRIPE_PRICE_STARTER_MONTHLY = "price_starter_monthly";
    process.env.STRIPE_PRICE_MAX_YEARLY = "price_max_yearly";

    assert.deepEqual(
      getPriceKeyFromStripePriceId("price_starter_monthly"),
      { key: "starter_monthly", plan: "starter", billing: "monthly" }
    );
    assert.deepEqual(
      getPriceKeyFromStripePriceId("price_max_yearly"),
      { key: "max_yearly", plan: "max", billing: "yearly" }
    );
  } finally {
    if (originalStarter === undefined) {
      delete process.env.STRIPE_PRICE_STARTER_MONTHLY;
    } else {
      process.env.STRIPE_PRICE_STARTER_MONTHLY = originalStarter;
    }
    if (originalMax === undefined) {
      delete process.env.STRIPE_PRICE_MAX_YEARLY;
    } else {
      process.env.STRIPE_PRICE_MAX_YEARLY = originalMax;
    }
  }
});
