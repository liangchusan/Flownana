import assert from "node:assert/strict";
import test from "node:test";
import { allowedAnalyticsHost, commerceEvent, measurementIdForEnvironment, PRODUCTION_GA_ID, safePage, TEST_GA_ID, validContext } from "../lib/analytics-policy.ts";
import { createSourceLoader } from "./helpers/load-source.ts";

test("both environment and hostname prohibit cross-property collection", () => {
  assert.equal(measurementIdForEnvironment("preview", PRODUCTION_GA_ID), null);
  assert.equal(measurementIdForEnvironment("production", TEST_GA_ID), null);
  assert.equal(measurementIdForEnvironment("production", PRODUCTION_GA_ID), PRODUCTION_GA_ID);
  assert.equal(measurementIdForEnvironment(undefined, TEST_GA_ID), TEST_GA_ID);
  assert.equal(allowedAnalyticsHost(PRODUCTION_GA_ID, "flownana-test.vercel.app"), false);
  assert.equal(allowedAnalyticsHost(TEST_GA_ID, "www.flownana.com"), false);
  assert.equal(allowedAnalyticsHost(TEST_GA_ID, "localhost"), true);
});
test("private paths, query strings, identity, media URLs and titles never survive page sanitization", () => {
  for (const path of ["/agent/private-thread?prompt=secret&token=secret", "/account/billing?session_id=cs_secret", "/private/person@example.com?code=secret"]) {
    const event = safePage(path, "https://www.flownana.com", "https://accounts.google.com/?email=person@example.com");
    assert.doesNotMatch(JSON.stringify(event), /private-thread|secret|person@|email|session_id|prompt/);
    assert.equal(event.page_referrer, "https://accounts.google.com");
  }
  const page = safePage("/?utm_source=google&utm_campaign=us_search&gclid=opaque_click&email=person@example.com", "https://www.flownana.com");
  assert.match(page.page_location, /utm_campaign=us_search/);
  assert.doesNotMatch(page.page_location, /email/);
});
test("contexts require real GA format, correct property, nonfuture timestamp and lifetime", () => {
  const c = { clientId: "1234.5678", sessionId: 1234, capturedAt: 10000, measurementId: TEST_GA_ID };
  assert.ok(validContext(c, TEST_GA_ID, 10001));
  for (const bad of [{ ...c, clientId: "email@example.com" }, { ...c, sessionId: 0 }, { ...c, capturedAt: 10002 }, { ...c, measurementId: PRODUCTION_GA_ID }]) assert.equal(validContext(bad, TEST_GA_ID, 10001), null);
  assert.equal(validContext(c, TEST_GA_ID, 10000 + 72 * 3600000), null);
  assert.deepEqual(validContext({ ...c, email: "private@example.test" }, TEST_GA_ID, 10001), c);
});
test("ecommerce units are dollars, price/item/value match and invalid amounts are rejected", () => {
  assert.deepEqual(commerceEvent("starter_monthly", 1600, "usd"), { currency: "USD", value: 16, items: [{ item_id: "starter_monthly", item_name: "starter monthly", price: 16, quantity: 1 }] });
  assert.equal(commerceEvent("unknown", 1600, "USD"), null);
  assert.equal(commerceEvent("starter_monthly", -1, "USD"), null);
  assert.equal(commerceEvent("starter_monthly", 16.2, "USD"), null);
  assert.equal(commerceEvent("starter_monthly", 1600, "JPY"), null);
});

test("browser checkout requires a real Stripe URL, consent and one report per Checkout", t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const storage = new Map<string, string>([["flownana_analytics_consent", "granted"]]);
  const emitted: unknown[][] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { hostname: "localhost", href: "http://localhost/pricing", origin: "http://localhost" },
    localStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) },
    gtag: (...args: unknown[]) => emitted.push(args),
    dispatchEvent() {},
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { referrer: "" } });
  const oldEnabled = process.env.NEXT_PUBLIC_GA_ENABLED, oldId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  process.env.NEXT_PUBLIC_GA_ENABLED = "true"; process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = TEST_GA_ID;
  t.after(() => {
    originalWindow ? Object.defineProperty(globalThis, "window", originalWindow) : Reflect.deleteProperty(globalThis, "window");
    originalDocument ? Object.defineProperty(globalThis, "document", originalDocument) : Reflect.deleteProperty(globalThis, "document");
    oldEnabled === undefined ? delete process.env.NEXT_PUBLIC_GA_ENABLED : process.env.NEXT_PUBLIC_GA_ENABLED = oldEnabled;
    oldId === undefined ? delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID : process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = oldId;
  });
  const load = createSourceLoader({});
  const client = load<typeof import("../lib/analytics")>("lib/analytics.ts");
  client.configureAnalyticsCollection({ defaultAnalytics: false, gpc: false });
  const checkout = { id: "cs_fixture", url: "https://checkout.stripe.com/c/pay/cs_fixture", event: commerceEvent("pro_yearly", 12345, "USD")! };
  for (const bad of [{ ...checkout, url: undefined }, { ...checkout, event: undefined }, { ...checkout, url: "/account/billing" },
    { ...checkout, url: "https://checkout.stripe.com.evil.test/pay" }, { ...checkout, url: "http://checkout.stripe.com/pay" }]) assert.equal(client.trackCheckout(bad), false);
  assert.equal(client.trackCheckout(checkout), true); assert.equal(client.trackCheckout(checkout), false);
  // A new module/browser lifecycle must still respect persisted Checkout deduplication.
  assert.equal(createSourceLoader({})<typeof import("../lib/analytics")>("lib/analytics.ts").trackCheckout(checkout), false);
  assert.equal(emitted.length, 1); assert.equal(emitted[0][1], "begin_checkout");
  assert.equal((emitted[0][2] as any).value, 123.45);
  storage.set("flownana_analytics_consent", "denied"); assert.equal(client.trackCheckout({ ...checkout, id: "cs_another" }), false);
  assert.equal(client.trackEvent("purchase" as any, {}), false); assert.equal(emitted.length, 1);
  storage.set("flownana_analytics_consent", "granted");
  window.localStorage.setItem = () => { throw new Error("fixture storage unavailable"); };
  client.setAnalyticsConsent(false);
  assert.equal(client.hasAnalyticsConsent(), false); assert.equal(window[`ga-disable-${TEST_GA_ID}`], true);
  assert.equal(client.trackCheckout({ ...checkout, id: "cs_revoked" }), false);
});

test("Google tag initialization uses the SDK command object and configures one consented property", t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const effects: Array<() => unknown> = [];
  const browser = { location: { hostname: "localhost", href: "http://localhost/", origin: "http://localhost" },
    addEventListener() {}, removeEventListener() {}, setInterval() { return 1; }, clearInterval() {}, dataLayer: [] as unknown[], gtag: undefined as any };
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { referrer: "" } });
  t.after(() => {
    originalWindow ? Object.defineProperty(globalThis, "window", originalWindow) : Reflect.deleteProperty(globalThis, "window");
    originalDocument ? Object.defineProperty(globalThis, "document", originalDocument) : Reflect.deleteProperty(globalThis, "document");
  });
  const source = createSourceLoader({
    react: { useEffect: (work: () => unknown) => effects.push(work), useRef: () => ({ current: null }), useState: () => [false, () => {}] },
    "next-auth/react": { useSession: () => ({ data: null }) }, "next/navigation": { usePathname: () => "/" },
    "@/lib/analytics": { GA_ENABLED: true, GA_MEASUREMENT_ID: TEST_GA_ID, hasAnalyticsConsent: () => true, setTagDisabled() {}, reconcileAnalyticsRevocation: async () => true },
  });
  source<any>("components/analytics/analytics-events.tsx").AnalyticsEvents({ measurementAllowed: true });
  effects[1]();
  assert.equal(browser.dataLayer.length, 3);
  for (const command of browser.dataLayer) assert.equal(Object.prototype.toString.call(command), "[object Arguments]");
  const config = browser.dataLayer[2] as IArguments;
  assert.equal(config[0], "config"); assert.equal(config[1], TEST_GA_ID);
  assert.equal(config[2].send_page_view, false); assert.equal(config[2].debug_mode, true);
  effects[1](); assert.equal(browser.dataLayer.length, 4);
  assert.equal((browser.dataLayer[3] as IArguments)[0], "consent");
});

test("context capture confirms the SDK identifiers after initial session startup", async t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousEnabled = process.env.NEXT_PUBLIC_GA_ENABLED, previousId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  let clientReads = 0;
  const browser = {
    dispatchEvent() {},
    location: { hostname: "localhost" },
    localStorage: { getItem: (key: string) => key === "flownana_analytics_consent" ? "granted" : null },
    gtag: (command: string, _id: string, key: string, callback: (value: unknown) => void) => {
      assert.equal(command, "get");
      callback(key === "session_id" ? 1791160000 : ++clientReads === 1 ? "111.1791160000" : "222.1791160000");
    },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  Object.assign(process.env, { NEXT_PUBLIC_GA_ENABLED: "true", NEXT_PUBLIC_GA_MEASUREMENT_ID: TEST_GA_ID });
  t.after(() => {
    originalWindow ? Object.defineProperty(globalThis, "window", originalWindow) : Reflect.deleteProperty(globalThis, "window");
    previousEnabled === undefined ? delete process.env.NEXT_PUBLIC_GA_ENABLED : process.env.NEXT_PUBLIC_GA_ENABLED = previousEnabled;
    previousId === undefined ? delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID : process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = previousId;
  });
  const client = createSourceLoader({})<typeof import("../lib/analytics")>("lib/analytics.ts");
  client.configureAnalyticsCollection({ defaultAnalytics: false, gpc: false });
  const context = await client.captureAnalyticsContext();
  assert.equal(context?.clientId, "222.1791160000");
  assert.equal(context?.sessionId, 1791160000); assert.equal(clientReads, 2);
});

test("offline withdrawal survives reload and concurrent withdrawals cannot resume before acknowledgement", async t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalFetch = globalThis.fetch;
  const previousEnabled = process.env.NEXT_PUBLIC_GA_ENABLED, previousId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const storage = new Map<string, string>([["flownana_analytics_consent", "granted"]]);
  const emitted: unknown[][] = [], requests: string[] = [];
  let online = false, status = 200;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { hostname: "localhost", href: "http://localhost/", origin: "http://localhost" },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    gtag: (...args: unknown[]) => emitted.push(args), dispatchEvent() {},
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { referrer: "" } });
  Object.assign(process.env, { NEXT_PUBLIC_GA_ENABLED: "true", NEXT_PUBLIC_GA_MEASUREMENT_ID: TEST_GA_ID });
  globalThis.fetch = (async (_input: unknown, init: RequestInit) => {
    requests.push(init.method!); if (!online) throw new Error("offline"); return new Response(null, { status });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    originalWindow ? Object.defineProperty(globalThis, "window", originalWindow) : Reflect.deleteProperty(globalThis, "window");
    originalDocument ? Object.defineProperty(globalThis, "document", originalDocument) : Reflect.deleteProperty(globalThis, "document");
    previousEnabled === undefined ? delete process.env.NEXT_PUBLIC_GA_ENABLED : process.env.NEXT_PUBLIC_GA_ENABLED = previousEnabled;
    previousId === undefined ? delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID : process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = previousId;
  });
  const loadClient = () => {
    const client = createSourceLoader({})<typeof import("../lib/analytics")>("lib/analytics.ts");
    client.configureAnalyticsCollection({ defaultAnalytics: false, gpc: false });
    return client;
  };
  const client = loadClient(); client.setAnalyticsConsent(false);
  assert.equal(await client.reconcileAnalyticsRevocation(), false);
  assert.ok(storage.get("flownana_analytics_revocation_pending"));
  const reloaded = loadClient(); reloaded.setAnalyticsConsent(true);
  assert.equal(await reloaded.reconcileAnalyticsRevocation(), false);
  assert.equal(reloaded.trackPageView("/"), false); assert.equal(window[`ga-disable-${TEST_GA_ID}`], true);
  online = true; status = 503;
  assert.equal(await reloaded.reconcileAnalyticsRevocation(), false);
  assert.equal(reloaded.hasAnalyticsConsent(), false);
  status = 200;
  assert.equal(await reloaded.reconcileAnalyticsRevocation(), true);
  assert.equal(storage.has("flownana_analytics_revocation_pending"), false);
  assert.equal(reloaded.hasAnalyticsConsent(), true);
  assert.equal(reloaded.trackPageView("/"), true);
  assert.equal(emitted.filter(command => command[0] === "event").length, 1);
  assert.ok(requests.every(method => method === "DELETE"));
  let acknowledge!: (response: Response) => void;
  globalThis.fetch = (() => new Promise<Response>(resolve => { acknowledge = resolve; })) as typeof fetch;
  reloaded.setAnalyticsConsent(false);
  const firstMarker = storage.get("flownana_analytics_revocation_pending");
  reloaded.setAnalyticsConsent(false);
  assert.notEqual(storage.get("flownana_analytics_revocation_pending"), firstMarker);
  const obsolete = reloaded.reconcileAnalyticsRevocation(); acknowledge(new Response(null, { status: 200 }));
  assert.equal(await obsolete, false);
  assert.ok(storage.get("flownana_analytics_revocation_pending"));
  globalThis.fetch = (async () => new Response(null, { status: 200 })) as typeof fetch;
  assert.equal(await reloaded.reconcileAnalyticsRevocation(), true);
  assert.equal(reloaded.hasAnalyticsConsent(), false); // An acknowledgement never grants consent.
  assert.equal(reloaded.trackPageView("/"), false);
});

test("pricing counts real visibility once, not rerenders, cycle changes, failed or hidden opening", t => {
  let intersect: (entries: unknown[]) => void = () => {};
  const timers: Array<() => void> = [], effects: Array<() => (() => void)> = [], events: unknown[] = [];
  const reported = { current: false };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const target = {};
  Object.defineProperty(globalThis, "window", { configurable: true, value: { setInterval: (fn: () => void) => { timers.push(fn); return 1; }, clearInterval() {} } });
  const doc = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  t.after(() => { originalWindow ? Object.defineProperty(globalThis, "window", originalWindow) : Reflect.deleteProperty(globalThis, "window"); originalDocument ? Object.defineProperty(globalThis, "document", originalDocument) : Reflect.deleteProperty(globalThis, "document"); });
  const originalObserver = Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver");
  Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, value: class { constructor(fn: any) { intersect = fn; } observe(el: any) { assert.equal(el, target); } disconnect() {} } });
  t.after(() => originalObserver ? Object.defineProperty(globalThis, "IntersectionObserver", originalObserver) : Reflect.deleteProperty(globalThis, "IntersectionObserver"));
  const load = createSourceLoader({ react: { useRef: () => ({ current: { nextElementSibling: target } }), useEffect: (fn: any) => effects.push(fn) },
    "@/lib/analytics": { trackEvent: (name: string, params: unknown) => { events.push({ name, params }); return true; } } });
  const Exposure = load<any>("components/analytics/pricing-exposure.tsx").PricingExposure;
  Exposure({ billing: "yearly", reported }); effects[0]();
  assert.equal(events.length, 0); intersect([{ isIntersecting: false }]); assert.equal(events.length, 0);
  doc.visibilityState = "hidden"; intersect([{ isIntersecting: true }]); assert.equal(events.length, 0);
  doc.visibilityState = "visible"; timers[0](); assert.equal(events.length, 1);
  intersect([{ isIntersecting: true }]); timers[0](); assert.equal(events.length, 1);
  Exposure({ billing: "monthly", reported }); effects[1](); intersect([{ isIntersecting: true }]); assert.equal(events.length, 1);
  Exposure({ billing: "monthly", reported: { current: false } }); effects[2](); intersect([{ isIntersecting: true }]); assert.equal(events.length, 2);
});
