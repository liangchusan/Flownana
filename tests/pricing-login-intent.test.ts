import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";

test("a selected plan survives sign-in only within the current tab and ten minutes", (t) => {
  const saved = new Map<string, string>();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousNow = Date.now;
  let now = 100_000;
  Date.now = () => now;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    sessionStorage: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
      removeItem: (key: string) => saved.delete(key),
    },
  } });
  t.after(() => {
    Date.now = previousNow;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });
  const intent = createSourceLoader({})<typeof import("../lib/pricing-login-intent")>("lib/pricing-login-intent.ts");
  intent.savePricingLoginIntent("pro_monthly");
  assert.equal(intent.readPricingLoginIntent(), "pro_monthly");
  now += 10 * 60 * 1000;
  assert.equal(intent.readPricingLoginIntent(), null);
  assert.equal(saved.size, 0);
  intent.savePricingLoginIntent("max_yearly");
  intent.clearPricingLoginIntent();
  assert.equal(intent.readPricingLoginIntent(), null);
});

test("invalid or tampered login choices are discarded", (t) => {
  const saved = new Map<string, string>();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    sessionStorage: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
      removeItem: (key: string) => saved.delete(key),
    },
  } });
  t.after(() => previousWindow ? Object.defineProperty(globalThis, "window", previousWindow) : Reflect.deleteProperty(globalThis, "window"));
  const intent = createSourceLoader({})<typeof import("../lib/pricing-login-intent")>("lib/pricing-login-intent.ts");
  intent.savePricingLoginIntent("starter_yearly");
  const key = [...saved.keys()][0];
  saved.set(key, JSON.stringify({ priceKey: "illegal_plan", createdAt: Date.now() }));
  assert.equal(intent.readPricingLoginIntent(), null);
  assert.equal(saved.size, 0);
});

test("pricing sign-in returns to the original page with the modal open", async (t) => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: new URL("https://www.flownana.com/image?mode=agent"),
  } });
  t.after(() => previousWindow ? Object.defineProperty(globalThis, "window", previousWindow) : Reflect.deleteProperty(globalThis, "window"));
  let received: { provider: string; callbackUrl: string } | null = null;
  const auth = createSourceLoader({
    "next-auth/react": { signIn: async (provider: string, options: { callbackUrl: string }) => {
      received = { provider, callbackUrl: options.callbackUrl };
    } },
  })<typeof import("../lib/auth-sign-in")>("lib/auth-sign-in.ts");
  await auth.signInForCurrentEnvironment(true);
  assert.equal((received as unknown as { callbackUrl: string }).callbackUrl, "https://www.flownana.com/image?mode=agent#pricing");
});
