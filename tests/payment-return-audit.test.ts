import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Billing browser has no purchase transport for forged, verified or refreshed return URLs", () => {
  const source = readFileSync(new URL("../app/account/billing/billing-client.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /VerifiedPurchaseEvent|trackEvent|gtag\(/);
  assert.match(source, /verifiedPurchase/); // Display data remains, with no transport side effect.
});
