type StripeCheckoutAccessInput = {
  secretKey: string | undefined;
  vercelEnv: string | undefined;
  liveCheckoutEnabled?: string;
  testBillingEnabled?: string;
  testDatabaseRef?: string;
  databaseUrl?: string;
};

const PRODUCTION_DATABASE_REF = "kbpmirqktzxlpkfeuhtn";

// Old previews can still point at the main database. An opt-in alone is insufficient.
export function isIsolatedStripeTestBilling(input: StripeCheckoutAccessInput): boolean {
  const enabled = input.testBillingEnabled ?? process.env.STRIPE_TEST_BILLING_ENABLED;
  const ref = input.testDatabaseRef ?? process.env.STRIPE_TEST_DATABASE_REF;
  const connection = input.databaseUrl ?? process.env.DATABASE_URL;
  if (input.vercelEnv !== "preview" || enabled !== "true" ||
      !isStripeTestModeSecret(input.secretKey) || !ref || !/^[a-z]{20}$/.test(ref) ||
      ref === PRODUCTION_DATABASE_REF || !connection) return false;
  try {
    const url = new URL(connection);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || url.pathname !== "/postgres" ||
        url.searchParams.has("host") || url.searchParams.has("port")) return false;
    if (url.hostname === `db.${ref}.supabase.co`) return true;
    return /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) &&
      decodeURIComponent(url.username).endsWith(`.${ref}`);
  } catch { return false; }
}

export function isStripeTestModeSecret(secretKey: string | undefined): boolean {
  const normalized = secretKey?.trim();
  return Boolean(
    normalized?.startsWith("sk_test_") || normalized?.startsWith("rk_test_")
  );
}

export function canProcessStripeBilling(input: StripeCheckoutAccessInput): boolean {
  return (input.vercelEnv === "production" && /^(sk|rk)_live_/.test(input.secretKey?.trim() || "")) ||
    isIsolatedStripeTestBilling(input);
}

export function canCreateStripeCheckout(input: StripeCheckoutAccessInput): boolean {
  return isIsolatedStripeTestBilling(input) ||
    (canProcessStripeBilling(input) && input.liveCheckoutEnabled === "true");
}

export function shouldIgnoreStripeTestWebhook(params: {
  livemode: boolean;
  vercelEnv: string | undefined;
  secretKey?: string;
  testBillingEnabled?: string;
  testDatabaseRef?: string;
  databaseUrl?: string;
}): boolean {
  return !canFinalizeStripeCheckout(params);
}

export function canFinalizeStripeCheckout(params: {
  livemode: boolean;
  vercelEnv: string | undefined;
  secretKey?: string;
  testBillingEnabled?: string;
  testDatabaseRef?: string;
  databaseUrl?: string;
}): boolean {
  if (params.vercelEnv === "production") return params.livemode;
  return !params.livemode && isIsolatedStripeTestBilling({ ...params,
    secretKey: params.secretKey ?? process.env.STRIPE_SECRET_KEY });
}
