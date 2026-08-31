import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import * as React from "react";
import { createSourceLoader } from "./helpers/load-source.ts";

function fixture(t: TestContext, summary: unknown) {
  const slots: any[] = [];
  let index = 0;
  const effects: Array<() => void> = [];
  const requests: Array<{ url: string; init: RequestInit; resolve: (response: Response) => void }> = [];
  const notices: unknown[] = [];
  t.mock.method(globalThis, "fetch", (url: any, init?: RequestInit) => new Promise<Response>((resolve) => requests.push({ url: String(url), init: init || {}, resolve })));
  const location = { href: "" };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location } });
  t.after(() => Reflect.deleteProperty(globalThis, "window"));
  const owner = createSourceLoader({})<typeof import("../lib/account-operation")>("lib/account-operation.ts").createAccountOperationOwner("fixture-a");
  const load = createSourceLoader({
    react: { ...React,
      useState: (initial: any) => { const slot = index++; if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial; return [slots[slot], (next: any) => { slots[slot] = typeof next === "function" ? next(slots[slot]) : next; }]; },
      useRef: (initial: any) => { const slot = index++; return slots[slot] ??= { current: initial }; },
      useEffect: (effect: () => void, dependencies: unknown[]) => { const slot = index++; if (!slots[slot] || dependencies.some((value, i) => value !== slots[slot][i])) { slots[slot] = dependencies; effects.push(effect); } },
    },
    "next-auth/react": { useSession: () => ({ data: { user: { id: "fixture-a", accountCreatedAt: "2026-08-31T00:00:00.000Z" } }, status: "authenticated" }) },
    "@/lib/use-account-operation": { useAccountOperation: () => ({ accountScope: "fixture-a", capture: owner.capture }) },
    "@/lib/billing-summary-client": { fetchBillingSummary: async () => summary },
    "@/components/blocks/app-toast-provider": { useToast: () => ({ showToast: (value: unknown) => notices.push(value) }) },
  });
  const outer = load<any>("components/pricing/pricing-plans.tsx").PricingPlans;
  const inner = outer({ stripeEnabled: true }).type;
  const render = () => { index = 0; const tree = inner({ stripeEnabled: true }); effects.splice(0).forEach((effect) => effect()); return tree; };
  return { render, requests, owner, location, notices };
}

function elements(tree: any): any[] {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}
const buttons = (tree: any, label: string) => elements(tree).filter((element) => element.props?.children === label && typeof element.props?.onClick === "function");
const modal = (tree: any) => elements(tree).find((element) => typeof element.props?.onConfirm === "function");

test("actual pricing blocks unknown billing rather than treating a failed summary as a free plan", async (t) => {
  const f = fixture(t, null);
  assert.equal(buttons(f.render(), "Loading your plan…").length, 3);
  await Promise.resolve();
  const next = f.render();
  assert.equal(buttons(next, "Choose plan").length, 0);
  assert.equal(buttons(next, "Retry plan lookup").length, 3);
  assert.equal(f.requests.length, 0);
});

test("late upgrade quotes cannot replace the selected plan or reopen a closed quote", async (t) => {
  const f = fixture(t, { subscription: { planType: "starter", billingCycle: "monthly" } });
  f.render(); await Promise.resolve();
  const choices = buttons(f.render(), "Upgrade");
  assert.equal(choices.length, 2);
  const first = choices[0].props.onClick();
  const second = choices[1].props.onClick();
  assert.match(f.requests[0].url, /pro_monthly/);
  assert.match(f.requests[1].url, /max_monthly/);
  f.requests[1].resolve(Response.json({ payableAmountCents: 9600, targetAmountCents: 9600, currency: "usd" }));
  await second;
  f.requests[0].resolve(Response.json({ payableAmountCents: 4800, targetAmountCents: 4800, currency: "usd" }));
  await first;
  assert.match(modal(f.render()).props.chargeLine, /96\.00/);
  const third = buttons(f.render(), "Upgrade")[0].props.onClick();
  modal(f.render()).props.onClose();
  f.requests[2].resolve(Response.json({ payableAmountCents: 4800, currency: "usd" }));
  await third;
  assert.equal(modal(f.render()).props.open, false);
  assert.equal(modal(f.render()).props.chargeLine, null);
});

test("checkout uses the captured account and an unmounted account cannot navigate on a late response", async (t) => {
  const f = fixture(t, { subscription: null });
  f.render(); await Promise.resolve();
  const request = buttons(f.render(), "Choose plan")[0].props.onClick();
  assert.equal(new Headers(f.requests[0].init.headers).get("x-flownana-account"), "fixture-a");
  f.owner.dispose();
  f.requests[0].resolve(Response.json({ url: "https://checkout.example/old-account" }));
  await request;
  assert.equal(f.location.href, "");
  assert.deepEqual(f.notices, []);
});
