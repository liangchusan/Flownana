import assert from "node:assert/strict";
import test from "node:test";
import { analyticsCollectionBasis, analyticsCollectionPolicy, permitsAnalyticsContext } from "../lib/analytics-collection-policy.ts";
import { createSourceLoader } from "./helpers/load-source.ts";

test("regional defaults are limited, unknown countries require a choice, and rejection/GPC override grants", () => {
  for (const country of ["US", "JP", "TW"]) {
    const headers = new Headers({ "x-vercel-ip-country": country });
    const policy = analyticsCollectionPolicy(headers);
    assert.equal(analyticsCollectionBasis(policy, null), "regional_default");
    assert.equal(analyticsCollectionBasis(policy, "denied"), null);
    assert.equal(permitsAnalyticsContext(headers, "regional_default"), true);
  }
  for (const country of ["KR", "DE", "GB", "CH", "HK", "", "USA"]) {
    const headers = new Headers({ "x-vercel-ip-country": country, "accept-language": "en-US" });
    const policy = analyticsCollectionPolicy(headers);
    assert.equal(analyticsCollectionBasis(policy, null), null);
    assert.equal(analyticsCollectionBasis(policy, "granted"), "explicit");
    assert.equal(permitsAnalyticsContext(headers, "regional_default"), false);
  }
  const headers = new Headers({ "x-vercel-ip-country": "US", "sec-gpc": "1" });
  assert.equal(analyticsCollectionBasis(analyticsCollectionPolicy(headers), "granted"), null);
  assert.equal(permitsAnalyticsContext(headers, "explicit"), false);
  assert.equal(permitsAnalyticsContext(headers), false);
  assert.equal(analyticsCollectionBasis(null, "granted"), null);
});

test("policy endpoint avoids cache sharing across regions and privacy signals", async () => {
  const route = createSourceLoader({})<typeof import("../app/api/analytics/policy/route")>("app/api/analytics/policy/route.ts");
  for (const country of ["US", "DE"]) {
    const response = route.GET(new Request("https://flownana-test.vercel.app/api/analytics/policy", { headers: { "x-vercel-ip-country": country } }));
    assert.match(response.headers.get("cache-control")!, /private, no-store/);
    assert.match(response.headers.get("vary")!, /sec-gpc/);
    assert.deepEqual(await response.json(), { defaultAnalytics: country === "US", gpc: false });
  }
});

test("browser default collection does not invent a grant, preserves denial, and fails closed without storage", t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null }, dispatchEvent() {},
  } });
  t.after(() => originalWindow ? Object.defineProperty(globalThis, "window", originalWindow) : Reflect.deleteProperty(globalThis, "window"));
  const client = createSourceLoader({})<typeof import("../lib/analytics")>("lib/analytics.ts");
  assert.equal(client.hasAnalyticsConsent(), false);
  client.configureAnalyticsCollection({ defaultAnalytics: true, gpc: false });
  assert.equal(client.hasAnalyticsConsent(), true);
  assert.equal(storage.has("flownana_analytics_consent"), false);
  storage.set("flownana_analytics_consent", "denied");
  assert.equal(client.hasAnalyticsConsent(), false);
  storage.set("flownana_analytics_consent", "granted");
  client.configureAnalyticsCollection({ defaultAnalytics: false, gpc: false });
  assert.equal(client.hasAnalyticsConsent(), true);
  window.localStorage.getItem = () => { throw new Error("storage unavailable"); };
  assert.equal(client.hasAnalyticsConsent(), false);
});
