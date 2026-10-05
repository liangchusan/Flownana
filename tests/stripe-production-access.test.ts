import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreateStripeCheckout,
  canFinalizeStripeCheckout,
  canProcessStripeBilling,
  isStripeTestModeSecret,
  isIsolatedStripeTestBilling,
  shouldIgnoreStripeTestWebhook,
} from "../lib/stripe-production-access.ts";

test("detects Stripe test-mode secret keys without exposing their value", () => {
  assert.equal(isStripeTestModeSecret("sk_test_example"), true);
  assert.equal(isStripeTestModeSecret("rk_test_example"), true);
  assert.equal(isStripeTestModeSecret("sk_live_example"), false);
  assert.equal(isStripeTestModeSecret("rk_live_example"), false);
  assert.equal(isStripeTestModeSecret(undefined), false);
});

test("test billing cannot write from production, preview or local", () => {
  for (const vercelEnv of ["production", "preview", "development", undefined]) {
    const access = { secretKey: "sk_test_example", vercelEnv, liveCheckoutEnabled: "true" };
    assert.equal(canCreateStripeCheckout(access), false);
    assert.equal(canProcessStripeBilling(access), false);
    assert.equal(canFinalizeStripeCheckout({ livemode: false, vercelEnv }), false);
    assert.equal(shouldIgnoreStripeTestWebhook({ livemode: false, vercelEnv }), true);
  }
});

test("live checkout requires an explicit production launch gate", () => {
  assert.equal(
    canCreateStripeCheckout({
      secretKey: "sk_live_example",
      vercelEnv: "production",
    }),
    false
  );
  assert.equal(canCreateStripeCheckout({
    secretKey: "sk_live_example", vercelEnv: "production",
    liveCheckoutEnabled: "true" }), true);
  assert.equal(canProcessStripeBilling({
    secretKey: "sk_live_example", vercelEnv: "production" }), true);
  assert.equal(
    canCreateStripeCheckout({
      secretKey: "sk_live_example",
      vercelEnv: "preview",
      liveCheckoutEnabled: "true",
    }),
    false
  );
  assert.equal(
    canFinalizeStripeCheckout({
      livemode: true,
      vercelEnv: "production",
    }),
    true
  );
  assert.equal(canFinalizeStripeCheckout({ livemode: true, vercelEnv: "preview" }), false);
});

test("production ignores valid Stripe test-mode webhook events", () => {
  assert.equal(
    shouldIgnoreStripeTestWebhook({ livemode: false, vercelEnv: "production" }),
    true
  );
  assert.equal(
    shouldIgnoreStripeTestWebhook({ livemode: true, vercelEnv: "production" }),
    false
  );
  assert.equal(
    shouldIgnoreStripeTestWebhook({ livemode: false, vercelEnv: "preview" }),
    true
  );
});

const isolatedTestAccess = {
  secretKey: "sk_test_example", vercelEnv: "preview", testBillingEnabled: "true",
  testDatabaseRef: "heaahlpqqfehojzvozhr",
  databaseUrl: "postgresql://flownana_app.heaahlpqqfehojzvozhr:example@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres",
};

test("explicit isolated preview allows test checkout and test fulfillment only", () => {
  assert.equal(isIsolatedStripeTestBilling(isolatedTestAccess), true);
  assert.equal(canCreateStripeCheckout(isolatedTestAccess), true);
  assert.equal(canProcessStripeBilling(isolatedTestAccess), true);
  assert.equal(canFinalizeStripeCheckout({ ...isolatedTestAccess, livemode: false }), true);
  assert.equal(shouldIgnoreStripeTestWebhook({ ...isolatedTestAccess, livemode: false }), false);
  assert.equal(canFinalizeStripeCheckout({ ...isolatedTestAccess, livemode: true }), false);
  assert.equal(shouldIgnoreStripeTestWebhook({ ...isolatedTestAccess, livemode: true }), true);
});

test("test gate rejects shared databases, spoofed hosts, live keys and non-preview environments", () => {
  const invalid = [
    { testBillingEnabled: "false" },
    { testDatabaseRef: "kbpmirqktzxlpkfeuhtn", databaseUrl: "postgresql://postgres:example@db.kbpmirqktzxlpkfeuhtn.supabase.co/postgres" },
    { databaseUrl: "postgresql://postgres.kbpmirqktzxlpkfeuhtn:example@aws-1-ap-northeast-1.pooler.supabase.com/postgres" },
    { databaseUrl: "postgresql://postgres:example@db.kbpmirqktzxlpkfeuhtn.supabase.co/postgres" },
    { databaseUrl: "postgresql://postgres:example@db.heaahlpqqfehojzvozhr.supabase.co.evil.test/postgres" },
    { databaseUrl: `${isolatedTestAccess.databaseUrl}?host=db.kbpmirqktzxlpkfeuhtn.supabase.co` },
    { databaseUrl: "not a connection" },
    { secretKey: "sk_live_example" },
    { vercelEnv: "production" }, { vercelEnv: "development" }, { vercelEnv: undefined },
  ];
  for (const override of invalid) {
    const access = { ...isolatedTestAccess, ...override };
    assert.equal(isIsolatedStripeTestBilling(access), false);
    assert.equal(canCreateStripeCheckout(access), false);
    assert.equal(canFinalizeStripeCheckout({ ...access, livemode: false }), false);
    assert.equal(shouldIgnoreStripeTestWebhook({ ...access, livemode: false }), true);
  }
  assert.equal(isIsolatedStripeTestBilling({ ...isolatedTestAccess,
    databaseUrl: "postgresql://flownana_app:example@db.heaahlpqqfehojzvozhr.supabase.co:5432/postgres" }), true);
});
