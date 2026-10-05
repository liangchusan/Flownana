import assert from "node:assert/strict";
import test from "node:test";
import { checkoutCancelUrl } from "../lib/checkout-return.ts";

const base = "https://www.flownana.com";

test("canceled Checkout returns to the originating page with Pricing open", () => {
  assert.equal(checkoutCancelUrl(base, "/image?mode=agent"), `${base}/image?mode=agent#pricing`);
  assert.equal(checkoutCancelUrl(base, "/account/billing?checkout=success&session_id=old&tab=credits"),
    `${base}/account/billing?tab=credits#pricing`);
});

test("invalid or external return paths keep the legacy safe fallback", () => {
  for (const value of [undefined, "https://evil.example/", "//evil.example/", "/\\evil.example/",
    "/api/stripe/checkout", "/image#unexpected", "/image\nLocation: https://evil.example/"]) {
    assert.equal(checkoutCancelUrl(base, value), `${base}/pricing`);
  }
});
