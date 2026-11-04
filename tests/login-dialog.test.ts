import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";

function fixture(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const browser = new EventTarget();
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  t.after(() => previous ? Object.defineProperty(globalThis, "window", previous) : Reflect.deleteProperty(globalThis, "window"));
  let scope: string | null = null, preparations = 0, oauth = 0;
  const load = createSourceLoader({
    "./advertising-consent": { advertisingAccountScope: () => scope },
    "@/lib/analytics-sign-in": { prepareAnalyticsForSignIn: async () => { preparations++; return false; } },
    "next-auth/react": { signIn: async () => { oauth++; } },
  });
  const store = load<typeof import("../lib/login-dialog-store")>("lib/login-dialog-store.ts");
  const auth = load<typeof import("../lib/auth-sign-in")>("lib/auth-sign-in.ts");
  return { store, auth, browser, scope: (next: string | null) => { scope = next; }, stats: () => ({ preparations, oauth }) };
}

test("all shared sign-in callers open a dialog without preparing analytics or starting OAuth", async t => {
  const f = fixture(t);
  const first = f.auth.signInForCurrentEnvironment();
  assert.equal(f.store.getLoginDialogState().phase, "open");
  assert.deepEqual(f.stats(), { preparations: 0, oauth: 0 });
  assert.equal(f.auth.signInForCurrentEnvironment(true), first);
  assert.equal(f.store.getLoginDialogState().pricing, true);
  f.store.closeLoginDialog(); await first;
  assert.equal(f.store.getLoginDialogState().phase, "closed");
  assert.deepEqual(f.stats(), { preparations: 0, oauth: 0 });
});

test("closing and reopening gives a fresh operation and never retains another account's intent", async t => {
  const f = fixture(t); f.scope("a");
  const first = f.store.requestLoginDialog(true); f.store.closeLoginDialog(); await first;
  f.scope("b"); const second = f.store.requestLoginDialog();
  assert.notEqual(first, second);
  assert.deepEqual(f.store.getLoginDialogState(), { phase: "open", pricing: false, accountScope: "b" });
  f.store.closeLoginDialog(); await second;
});

test("connecting prevents duplicate starts and misleading cancellation; failure unlocks retry", async t => {
  const f = fixture(t); const pending = f.store.requestLoginDialog();
  assert.equal(f.store.beginLoginDialog(), true); assert.equal(f.store.beginLoginDialog(), false);
  f.store.closeLoginDialog(); assert.equal(f.store.getLoginDialogState().phase, "connecting");
  f.store.failLoginDialog(); assert.equal(f.store.getLoginDialogState().phase, "open");
  assert.equal(f.store.beginLoginDialog(), true); f.store.failLoginDialog(); f.store.closeLoginDialog(); await pending;
});

test("browser back from OAuth releases the dialog and a second explicit login can start", async t => {
  const f = fixture(t); const first = f.store.requestLoginDialog(true); f.store.beginLoginDialog();
  f.browser.dispatchEvent(new Event("pageshow")); assert.equal(f.store.getLoginDialogState().phase, "connecting");
  const event = new Event("pageshow"); Object.defineProperty(event, "persisted", { value: true }); f.browser.dispatchEvent(event); await first;
  assert.equal(f.store.getLoginDialogState().phase, "closed");
  const second = f.store.requestLoginDialog(); assert.notEqual(second, first); assert.equal(f.store.getLoginDialogState().pricing, false);
  f.store.closeLoginDialog(); await second;
});
