import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";

function fixture(authenticated: boolean, allow: () => Promise<boolean> = async () => true) {
  const states: any[] = [{ enabled: true, verified: authenticated, granted: false, pending: false }, false, "",
    { defaultAnalytics: false, gpc: false }, true, false, false, false];
  const refs: any[] = []; let cursor = 0, refCursor = 0, basic = false, adsCalls = 0;
  const choices: boolean[] = [];
  const source = createSourceLoader({
    "@/components/ui/button": { Button: "button" }, "next/link": { __esModule: true, default: "a" },
    react: { useEffect() {}, useLayoutEffect() {}, useRef: (initial: unknown) => refs[refCursor++] ?? (refs[refCursor - 1] = { current: initial }),
      useState: (initial: unknown) => { const index = cursor++; if (states[index] === undefined) states[index] = initial; return [states[index], (value: unknown) => { states[index] = value; }]; } },
    "next-auth/react": { useSession: () => ({ data: authenticated ? { user: { id: "fixture", accountCreatedAt: "2026-10-12T00:00:00.000Z" } } : null }) },
    "@/lib/analytics": { analyticsChoice: () => null, analyticsRevocationPending: () => false, configureAnalyticsCollection() {},
      hasAnalyticsConsent: () => basic, reconcileAnalyticsRevocation: async () => true, setAnalyticsConsent: (value: boolean) => { choices.push(value); basic = value; }, syncAnalyticsContext: async () => {} },
    "@/lib/advertising-consent": { ADVERTISING_EVENT: "fixture", advertisingState: () => states[0],
      allowAnonymousAdvertising: () => true, allowAdvertising: async () => { adsCalls++; return allow(); }, reconcileAdvertisingWithdrawal: async () => {}, refreshAdvertisingConsent: async () => {} },
    "@/lib/analytics-preferences": { dismissAnalyticsPrompt() {}, PRIVACY_SETTINGS_EVENT: "fixture", analyticsPromptDismissed: () => false, shouldPromptForAnalytics: () => false },
  });
  const component = source<typeof import("../components/analytics/analytics-preferences")>("components/analytics/analytics-preferences.tsx");
  const render = (): any => { cursor = 0; refCursor = 0; return component.AnalyticsPreferences(); };
  const nodes = (node: any): any[] => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  const button = (name: string) => nodes(render()).find(node => node.props?.children === name);
  return { render, button, choices, states, adsCalls: () => adsCalls };
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test("one combined action grants basic analytics and account-bound advertising; reject uses the common withdrawal path", async () => {
  const f = fixture(true); assert.ok(f.button("Allow")); assert.ok(f.button("Reject"));
  assert.equal(f.button("Allow ad measurement"), undefined); assert.equal(f.button("Allow analytics"), undefined);
  f.button("Allow").props.onClick(); await settle();
  assert.deepEqual(f.choices, [true]); assert.equal(f.adsCalls(), 1); assert.equal(f.states[4], false);
  f.states[4] = true; f.button("Reject").props.onClick(); await settle(); assert.deepEqual(f.choices, [true, false]);
});
test("anonymous Allow enables basic analytics without granting another account's advertising permission", async () => {
  const f = fixture(false); f.button("Allow").props.onClick(); await settle();
  assert.deepEqual(f.choices, [true]); assert.equal(f.adsCalls(), 0);
});
test("a late allow response cannot reopen the panel after Reject", async () => {
  let finish!: (value: boolean) => void;
  const f = fixture(true, () => new Promise(resolve => { finish = resolve; }));
  f.button("Allow").props.onClick(); await settle();
  assert.equal(f.adsCalls(), 1); f.button("Reject").props.onClick();
  finish(false); await settle(); assert.equal(f.states[4], false); assert.equal(f.states[2], "");
  assert.deepEqual(f.choices, [true, false]);
});
