import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";
import { shouldPromptForAnalytics } from "../lib/analytics-preferences.ts";

test("only an undecided visitor requiring consent gets a first-visit reminder", () => {
  const ask = { defaultAnalytics: false, gpc: false };
  assert.equal(shouldPromptForAnalytics(ask, null, false), true);
  assert.equal(shouldPromptForAnalytics(ask, null, true), false);
  for (const choice of ["granted", "denied"]) assert.equal(shouldPromptForAnalytics(ask, choice, false), false);
  assert.equal(shouldPromptForAnalytics({ defaultAnalytics: true, gpc: false }, null, false), false);
  assert.equal(shouldPromptForAnalytics({ defaultAnalytics: true, defaultAdvertising: true, gpc: false }, null, false), true);
  assert.equal(shouldPromptForAnalytics({ defaultAnalytics: true, defaultAdvertising: true, gpc: false }, null, true), false);
  assert.equal(shouldPromptForAnalytics({ defaultAnalytics: false, gpc: true }, null, false), false);
});

test("dismissal survives reload in the tab without writing a consent choice", t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const session = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    sessionStorage: { getItem: (key: string) => session.get(key) ?? null, setItem: (key: string, value: string) => session.set(key, value) },
    localStorage: { setItem() { assert.fail("dismissal must not grant or reject analytics"); } },
  } });
  t.after(() => originalWindow ? Object.defineProperty(globalThis, "window", originalWindow) : Reflect.deleteProperty(globalThis, "window"));
  const load = () => createSourceLoader({})<typeof import("../lib/analytics-preferences")>("lib/analytics-preferences.ts");
  const first = load();
  assert.equal(first.analyticsPromptDismissed(), false);
  first.dismissAnalyticsPrompt();
  assert.equal(load().analyticsPromptDismissed(), true);
  session.clear();
  assert.equal(load().analyticsPromptDismissed(), false);
  window.sessionStorage.getItem = () => { throw new Error("storage unavailable"); };
  window.sessionStorage.setItem = () => { throw new Error("storage unavailable"); };
  assert.equal(first.analyticsPromptDismissed(), false);
  assert.doesNotThrow(() => first.dismissAnalyticsPrompt());
});
