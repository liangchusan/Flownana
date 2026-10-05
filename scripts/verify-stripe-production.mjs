import Stripe from "stripe";

if (process.env.VERCEL_ENV === "production") {
  const key = process.env.STRIPE_SECRET_KEY || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const catalog = [
    ["starter_monthly", "STRIPE_PRICE_STARTER_MONTHLY", 1600, "month"],
    ["starter_yearly", "STRIPE_PRICE_STARTER_YEARLY", 9600, "year"],
    ["pro_monthly", "STRIPE_PRICE_PRO_MONTHLY", 4800, "month"],
    ["pro_yearly", "STRIPE_PRICE_PRO_YEARLY", 28800, "year"],
    ["max_monthly", "STRIPE_PRICE_MAX_MONTHLY", 9600, "month"],
    ["max_yearly", "STRIPE_PRICE_MAX_YEARLY", 57600, "year"],
  ];

  if (!key.startsWith("sk_live_") && !key.startsWith("rk_live_")) {
    throw new Error("Production Stripe key must be live mode.");
  }
  if (!webhookSecret.startsWith("whsec_")) {
    throw new Error("Production Stripe webhook secret is missing.");
  }

  const stripe = new Stripe(key, { maxNetworkRetries: 1, timeout: 8_000 });
  let account;
  try {
    account = await stripe.accounts.retrieve();
  } catch {
    throw new Error("Production Stripe account could not be verified.");
  }
  if (account.id !== "acct_1SwJs2RohkvhKuAJ" || !account.charges_enabled) {
    throw new Error("Production Stripe key is not attached to the ready Flownana account.");
  }

  await Promise.all(catalog.map(async ([name, envName, amount, interval]) => {
    const id = process.env[envName];
    if (!id?.startsWith("price_")) throw new Error(`Missing live Stripe Price for ${name}.`);
    let price;
    try {
      price = await stripe.prices.retrieve(id);
    } catch {
      throw new Error(`Live Stripe Price for ${name} could not be verified.`);
    }
    if (!price.livemode || !price.active || price.currency !== "usd" ||
      price.unit_amount !== amount || price.recurring?.interval !== interval ||
      price.recurring.interval_count !== 1) {
      throw new Error(`Live Stripe Price for ${name} does not match the product catalog.`);
    }
  }));

  console.log("Production Stripe account and six live Prices verified.");
}
