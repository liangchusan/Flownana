import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";

const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

function fixture(t: TestContext, options: { pending?: boolean; denied?: boolean; gpc?: boolean; disabled?: boolean; unknownRegion?: boolean } = {}) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.parse("2026-10-27T00:00:00Z") });
  const keys = ["NODE_ENV", "NEXT_PUBLIC_GA_ENABLED", "NEXT_PUBLIC_GA_MEASUREMENT_ID", "NEXT_PUBLIC_ENABLE_TEST_AUTH"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { NODE_ENV: "production", NEXT_PUBLIC_GA_ENABLED: options.disabled ? "false" : "true", NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-RP4MTRCXT0", NEXT_PUBLIC_ENABLE_TEST_AUTH: "false" });
  const globals = ["window", "navigator", "fetch", "document"] as const;
  const descriptors = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  t.after(() => {
    for (const key of keys) previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key];
    globals.forEach((key, i) => descriptors[i] ? Object.defineProperty(globalThis, key, descriptors[i]!) : Reflect.deleteProperty(globalThis, key));
  });
  const storage = new Map<string, string>(options.denied ? [["flownana_analytics_consent", "denied"]] : []);
  const browser = Object.assign(new EventTarget(), {
    location: new URL("http://localhost/image?utm_source=google&utm_medium=cpc&utm_campaign=fixture"),
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    gtag: undefined as undefined | ((...args: any[]) => void),
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { globalPrivacyControl: options.gpc === true } });
  const cookies = new Map<string, string>();
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    get cookie() { return [...cookies].map(([k, v]) => `${k}=${v}`).join("; "); },
    set cookie(value: string) { const [pair] = value.split(";"); const [key, content] = pair.split("="); if (value.includes("Max-Age=0")) cookies.delete(key); else cookies.set(key, content); },
  } });
  const warnings: unknown[][] = [];
  t.mock.method(console, "warn", (...args: unknown[]) => warnings.push(args));
  let scope: string | null = null;
  let transport: (init: RequestInit) => Promise<Response> = async () => new Response(null, { status: 200 });
  let withdrawalStatus = 200;
  let loginTransport = async (): Promise<void> => {};
  const requests: RequestInit[] = [], logins: { callbackUrl: string; analyticsReady?: string }[] = [], sequence: string[] = [];
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: async (url: string, init: RequestInit) => {
    assert.equal(url, "/api/analytics/context");
    if (init.method === "DELETE") return new Response(null, { status: withdrawalStatus });
    requests.push(init); sequence.push("post");
    const response = await transport(init);
    sequence.push(`response:${response.status}`);
    return response;
  } });
  const load = createSourceLoader({
    "./advertising-consent": { ADVERTISING_EVENT: "fixture:account", advertisingAccountScope: () => scope, configureAdvertisingDefault() {}, hasAdvertisingConsent: () => false, revokeAdvertising() {} },
    "next-auth/react": { signIn: async (provider: string, value: { callbackUrl: string }) => { assert.equal(provider, "google"); logins.push(value); sequence.push("oauth"); return loginTransport(); } },
  });
  const analytics = load<typeof import("../lib/analytics")>("lib/analytics.ts");
  const prepare = load<typeof import("../lib/analytics-sign-in")>("lib/analytics-sign-in.ts");
  const auth = load<typeof import("../lib/auth-sign-in")>("lib/auth-sign-in.ts");
  if (!options.pending) analytics.configureAnalyticsCollection({ defaultAnalytics: !options.unknownRegion, gpc: options.gpc === true });
  const ready = () => { browser.gtag = (command, _id, field, callback) => { if (command === "get") callback(field === "client_id" ? "123.456" : 1793000000); }; };
  ready();
  const advance = async (ms: number) => { for (let elapsed = 0; elapsed < ms; elapsed += 50) { t.mock.timers.tick(Math.min(50, ms - elapsed)); await settle(); } };
  return { analytics, prepare, auth, browser, ready, requests, warnings, logins, sequence, advance, storage, cookies,
    failWithdrawal: (failed: boolean) => { withdrawalStatus = failed ? 503 : 200; },
    loginTransport: (next: typeof loginTransport) => { loginTransport = next; },
    transport: (next: typeof transport) => { transport = next; },
    switchAccount: (next: string | null) => { scope = next; browser.dispatchEvent(new Event("fixture:account")); },
  };
}

test("login waits for confirmed context before OAuth and preserves UTM/pricing return", async t => {
  const f = fixture(t);
  let finish!: (response: Response) => void;
  f.transport(() => new Promise(resolve => { finish = resolve; }));
  const login = f.auth.continueSignInForCurrentEnvironment(true);
  await settle();
  assert.equal(f.logins.length, 0); assert.equal(f.requests.length, 1);
  finish(new Response(null, { status: 200 })); await login;
  assert.deepEqual(f.sequence, ["post", "response:200", "oauth"]);
  assert.equal(f.logins[0].callbackUrl, `${f.browser.location.origin}/image${f.browser.location.search}#pricing`);
  assert.equal(JSON.parse(f.requests[0].body as string).clientId, "123.456");
  assert.equal(f.warnings.length, 0);
});

test("double clicks and different entries share one login, including the redirect gap; pricing intent can upgrade while waiting", async t => {
  const f = fixture(t, { pending: true });
  const first = f.auth.continueSignInForCurrentEnvironment();
  const initialPageShow = new Event("pageshow");
  f.browser.dispatchEvent(initialPageShow);
  const second = f.auth.continueSignInForCurrentEnvironment(true);
  assert.equal(first, second);
  f.analytics.configureAnalyticsCollection({ defaultAnalytics: true, gpc: false });
  await f.advance(100); await first;
  assert.equal(f.requests.length, 1); assert.equal(f.logins.length, 1);
  assert.ok(f.logins[0].callbackUrl.endsWith("#pricing")); assert.equal(f.logins[0].analyticsReady, "1");
  await f.auth.continueSignInForCurrentEnvironment(); assert.equal(f.logins.length, 1);
  const returned = new Event("pageshow"); Object.defineProperty(returned, "persisted", { value: true });
  f.browser.dispatchEvent(returned);
  await f.auth.continueSignInForCurrentEnvironment(); assert.equal(f.logins.length, 2);
});

test("a failed OAuth request releases the login latch and permits an explicit retry", async t => {
  const f = fixture(t);
  f.loginTransport(async () => { throw new Error("fixture failure"); });
  await assert.rejects(f.auth.continueSignInForCurrentEnvironment(), /fixture failure/);
  f.loginTransport(async () => {});
  await f.auth.continueSignInForCurrentEnvironment(); assert.equal(f.logins.length, 2);
});

test("failed withdrawal persists a restrictive cookie; re-Allow cannot clear it before acknowledged withdrawal", async t => {
  const f = fixture(t);
  f.failWithdrawal(true); f.analytics.setAnalyticsConsent(false); await settle();
  assert.equal(f.cookies.get("flownana_analytics_blocked"), "1");
  await f.auth.continueSignInForCurrentEnvironment(); assert.equal(f.logins[0].analyticsReady, "0");
  f.analytics.setAnalyticsConsent(true); await settle();
  assert.equal(f.cookies.get("flownana_analytics_blocked"), "1"); assert.equal(f.analytics.hasAnalyticsConsent(), false);
  f.failWithdrawal(false); await f.analytics.reconcileAnalyticsRevocation();
  assert.equal(f.cookies.has("flownana_analytics_blocked"), false); assert.equal(f.analytics.hasAnalyticsConsent(), true);
});

test("an immediate login waits for policy and delayed SDK without collecting early", async t => {
  const f = fixture(t, { pending: true });
  f.browser.gtag = undefined;
  const login = f.auth.continueSignInForCurrentEnvironment();
  await f.advance(400);
  assert.equal(f.requests.length, 0); assert.equal(f.logins.length, 0);
  f.analytics.configureAnalyticsCollection({ defaultAnalytics: true, gpc: false });
  await f.advance(500); assert.equal(f.requests.length, 0);
  f.ready(); await f.advance(100); await login;
  assert.equal(f.requests.length, 1); assert.equal(f.logins.length, 1);
});

test("a provisional SDK callback timeout can recover on the next bounded attempt", async t => {
  const f = fixture(t);
  f.browser.gtag = () => {};
  const login = f.auth.continueSignInForCurrentEnvironment();
  await f.advance(1550); assert.equal(f.logins.length, 0);
  f.ready(); await f.advance(200); await login;
  assert.equal(f.requests.length, 1); assert.equal(f.warnings.length, 0);
});

test("network/HTTP transient failures retry but wait for a successful response", async t => {
  const f = fixture(t);
  f.transport(async () => {
    if (f.requests.length === 1) throw new Error("fixture private payload must not be logged");
    return new Response(null, { status: f.requests.length === 2 ? 503 : 200 });
  });
  const login = f.auth.continueSignInForCurrentEnvironment();
  await settle(); assert.equal(f.logins.length, 0);
  await f.advance(400); await login;
  assert.equal(f.requests.length, 3); assert.equal(f.warnings.length, 0);
  assert.equal(f.sequence.at(-1), "oauth");
});

test("permanent rejection is not retried; diagnostics contain only a fixed reason", async t => {
  const f = fixture(t);
  f.transport(async () => new Response("private server detail", { status: 403 }));
  await f.auth.continueSignInForCurrentEnvironment();
  assert.equal(f.requests.length, 1); assert.equal(f.logins.length, 1);
  assert.deepEqual(f.warnings, [["[analytics] Login context unavailable:", "http_rejected"]]);
});

test("exhausted transient errors stop at three attempts and login remains available", async t => {
  const f = fixture(t);
  f.transport(async () => new Response(null, { status: 503 }));
  const login = f.auth.continueSignInForCurrentEnvironment();
  await settle(); await f.advance(400); await login;
  assert.equal(f.requests.length, 3); assert.equal(f.logins.length, 1);
  assert.deepEqual(f.warnings[0], ["[analytics] Login context unavailable:", "retryable_http"]);
});

for (const mode of ["policy", "sdk", "callback", "http"] as const) {
  test(`unavailable ${mode} cannot hold login past the six second budget`, async t => {
    const f = fixture(t, { pending: mode === "policy" });
    if (mode === "sdk") f.browser.gtag = undefined;
    if (mode === "callback") f.browser.gtag = () => {};
    if (mode === "http") f.transport(init => new Promise((_, reject) => { init.signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true }); }));
    const login = f.auth.continueSignInForCurrentEnvironment();
    await settle(); await f.advance(5900);
    if (mode !== "callback") assert.equal(f.logins.length, 0);
    await f.advance(100); await login;
    assert.equal(f.logins.length, 1); assert.ok(f.requests.length <= 3);
    assert.equal(f.warnings.length, 1);
    const count = f.requests.length;
    f.ready(); f.analytics.configureAnalyticsCollection({ defaultAnalytics: true, gpc: false });
    await f.advance(5000); assert.equal(f.requests.length, count, "no background retry after OAuth");
  });
}

for (const option of ["denied", "gpc", "unknownRegion", "disabled"] as const) {
  test(`${option} continues login immediately without SDK reads or context POST`, async t => {
    const f = fixture(t, { [option]: true });
    f.browser.gtag = () => { throw new Error("must not read SDK"); };
    await f.auth.continueSignInForCurrentEnvironment();
    assert.equal(f.requests.length, 0); assert.equal(f.logins.length, 1); assert.equal(f.warnings.length, 0);
  });
}

test("withdrawal during SDK capture aborts it and a later Allow cannot resume the old login preparation", async t => {
  const f = fixture(t);
  f.browser.gtag = () => {};
  const login = f.auth.continueSignInForCurrentEnvironment();
  await f.advance(100);
  f.analytics.setAnalyticsConsent(false);
  f.analytics.setAnalyticsConsent(true);
  await settle(); await login;
  f.ready(); await f.advance(3000);
  assert.equal(f.requests.length, 0); assert.equal(f.logins.length, 1); assert.equal(f.warnings.length, 0);
});

test("account changes abort capture even when switching back before the SDK responds", async t => {
  const f = fixture(t);
  f.switchAccount("fixture-account-A");
  const callbacks: ((value: unknown) => void)[] = [];
  f.browser.gtag = (command, _id, _field, callback) => { if (command === "get") callbacks.push(callback); };
  const login = f.auth.continueSignInForCurrentEnvironment();
  await f.advance(100); f.switchAccount("fixture-account-B"); f.switchAccount("fixture-account-A");
  callbacks.forEach(callback => callback("123.456"));
  await settle(); await login;
  assert.equal(f.requests.length, 0); assert.equal(f.logins.length, 1); assert.equal(f.warnings.length, 0);
});

test("account scope accompanies the POST and switching accounts cancels an in-flight request", async t => {
  const f = fixture(t);
  f.switchAccount("fixture-account-A");
  f.transport(init => new Promise((_, reject) => { init.signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true }); }));
  const login = f.auth.continueSignInForCurrentEnvironment(); await settle();
  assert.equal((f.requests[0].headers as Record<string, string>)["x-flownana-account"], "fixture-account-A");
  f.switchAccount("fixture-account-B"); await login;
  assert.equal(f.requests[0].signal!.aborted, true);
  assert.equal(f.requests.length, 1); assert.equal(f.warnings.length, 0); assert.equal(f.logins.length, 1);
});
