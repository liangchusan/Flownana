import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createSourceLoader } from "./helpers/load-source.ts";

test("pricing opens over existing children and closes without changing the creation URL", (t) => {
  let open = false;
  const effects: Array<() => void> = [];
  const events: string[] = [];
  let location = new URL("https://www.flownana.com/image?model=flare");
  let replacements = 0;
  const listeners = new Map<string, () => void>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    get location() { return location; },
    history: { state: { existing: true }, replaceState: (state: unknown, _title: string, path: string) => {
      assert.deepEqual(state, { existing: true });
      replacements++;
      location = new URL(path, location);
    } },
    addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  } });
  t.after(() => previous ? Object.defineProperty(globalThis, "window", previous) : Reflect.deleteProperty(globalThis, "window"));
  const load = createSourceLoader({
    react: { ...React, useState: () => [open, (value: boolean) => { open = value; }],
      useCallback: (fn: unknown) => fn, useMemo: (fn: () => unknown) => fn(),
      useEffect: (fn: () => void) => effects.push(fn),
    },
    "next/dynamic": () => () => null,
    "@/lib/analytics": { trackEvent: (name: string) => events.push(name) },
  });
  const Provider = load<any>("components/pricing/pricing-modal-provider.tsx").PricingModalProvider;
  const draft = React.createElement("textarea", { defaultValue: "Keep my prompt" });
  const tree = Provider({ children: draft });
  tree.props.value.openPricing();
  assert.equal(open, true);
  assert.equal(Provider({ children: draft }).props.children[0], draft);
  tree.props.value.closePricing();
  assert.equal(open, false);
  assert.equal(replacements, 0);
  assert.equal(location.pathname + location.search, "/image?model=flare");
  effects[0]();
  location.hash = "pricing";
  listeners.get("hashchange")!();
  assert.equal(open, true);
  tree.props.value.closePricing();
  assert.equal(location.href, "https://www.flownana.com/image?model=flare");
  assert.equal(replacements, 1);
  assert.deepEqual(events, []);
});

test("legacy pricing URL redirects to the shared modal instead of rendering a pricing page", () => {
  const load = createSourceLoader({ "next/navigation": { redirect: (url: string) => { throw new Error(url); } } });
  const Page = load<any>("app/pricing/page.tsx").default;
  assert.throws(() => Page(), { message: "/#pricing" });
});
