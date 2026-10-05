import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";

test("Billing return distinguishes missing, unpaid, syncing and completed payment", async () => {
  class CheckoutPaymentIncompleteError extends Error {}
  let outcome: "unpaid" | "syncing" | "ready" = "unpaid";
  let summaryUnavailable = false;
  const summary = { subscription: { planType: "starter", billingCycle: "monthly" },
    paymentIssue: null, credits: { current: 200, expiringSoon: 0, expiringInDays: null } };
  const load = createSourceLoader({
    "next-auth": { getServerSession: async () => ({ user: { id: "return-test", accountCreatedAt: "2026-09-24T00:00:00.000Z" } }) },
    "@/lib/auth-options": { authOptions: {} },
    "@/lib/billing-summary": { getBillingSummary: async () => {
      if (summaryUnavailable) throw new Error("temporary billing outage");
      return summary;
    } },
    "@/lib/payment-reconciliation": { reconcilePendingPayment: async () => {} },
    "@/lib/plans": { PLAN_DISPLAY: { starter_monthly: { label: "Starter Monthly" } } },
    "@/lib/stripe-checkout-finalization": {
      CheckoutPaymentIncompleteError,
      finalizeCheckoutSession: async () => {
        if (outcome === "unpaid") throw new CheckoutPaymentIncompleteError();
        return { priceKey: "starter_monthly", isUpgrade: false, payableAmountCents: 1600,
          creditAmountCents: 0, currency: "USD", creditsGranted: false,
          entitlementsReady: outcome === "ready" };
      },
    },
    "@/lib/account-scope": { getAccountScope: () => "return-test-scope" },
    "./billing-client": { BillingClient: () => null },
  });
  const { default: BillingPage } = load<typeof import("../app/account/billing/page")>("app/account/billing/page.tsx");
  async function props(query: Record<string, string>) {
    const element = await BillingPage({ searchParams: Promise.resolve(query) });
    return element.props as { paymentNotice: string | null; isNewCheckout: boolean; verifiedPurchase: unknown };
  }
  assert.equal((await props({ checkout: "success" })).paymentNotice, "missing_session");
  assert.equal((await props({ checkout: "success", session_id: "cs_test_unpaid" })).paymentNotice, "unpaid");
  outcome = "syncing";
  const syncing = await props({ checkout: "success", session_id: "cs_test_paid" });
  assert.equal(syncing.paymentNotice, "syncing");
  assert.equal(syncing.isNewCheckout, false);
  assert.equal(syncing.verifiedPurchase, null);
  outcome = "ready";
  const ready = await props({ checkout: "success", session_id: "cs_test_paid" });
  assert.equal(ready.paymentNotice, null);
  assert.equal(ready.isNewCheckout, true);
  assert.ok(ready.verifiedPurchase);
  summaryUnavailable = true;
  const unavailable = await props({ checkout: "success", session_id: "cs_test_paid" });
  assert.equal(unavailable.paymentNotice, "syncing");
  assert.equal(unavailable.isNewCheckout, false);
  assert.equal(unavailable.verifiedPurchase, null);
});
