import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";
import { getAccountScope } from "../lib/account-scope.ts";
import * as React from "react";

const a = { id: "a", accountCreatedAt: "2026-08-31T00:00:00.000Z" };
const b = { ...a, id: "b" };
const seeds = [{ id: "private-a" }];

test("actual workspace and home entrypoints never relabel an old RSC seed as a new account", () => {
  let user = a;
  const load = createSourceLoader({ "next-auth/react": { useSession: () => ({ data: { user }, status: "authenticated" }) } });
  const workspace = load<any>("components/blocks/media-creation-workspace.tsx").MediaCreationWorkspace;
  const home = load<any>("app/home/create-content.tsx").CreateContent;
  for (const [component, prop] of [[workspace, "initialCreations"], [home, "initialRecentCreations"]] as const) {
    user = a;
    const props = { initialType: "image", [prop]: seeds, initialPrompt: "private draft", initialAccountScope: getAccountScope(a) };
    const first = component(props);
    assert.equal(first.props[prop], seeds);
    user = b;
    const second = component(props);
    assert.notEqual(second.key, first.key);
    assert.deepEqual(second.props[prop], []);
    if (component === workspace) assert.equal(second.props.initialPrompt, undefined);
    user = { ...a, accountCreatedAt: "2026-08-31T01:00:00.000Z" };
    assert.deepEqual(component(props).props[prop], []);
    user = a;
    assert.deepEqual(component({ ...props, initialAccountScope: undefined }).props[prop], []);
  }
});

test("pricing and legacy creation roots reset private state only when the account epoch changes", () => {
  let user: typeof a & { name?: string } = a;
  const load = createSourceLoader({ "next-auth/react": { useSession: () => ({ data: { user }, status: "authenticated" }) } });
  for (const component of [load<any>("components/pricing/pricing-plans.tsx").PricingPlans, load<any>("app/create/[mode]/create-content.tsx").CreateContent]) {
    user = a;
    const first = component({ mode: "image" });
    user = { ...a, name: "Updated profile name" };
    assert.equal(component({ mode: "image" }).key, first.key);
    user = b;
    assert.notEqual(component({ mode: "image" }).key, first.key);
  }
});

test("profile and billing seed boundary conceals another account but retains the same account during session refresh", () => {
  let user = a;
  let status = "authenticated";
  const load = createSourceLoader({ "next-auth/react": { useSession: () => ({ data: { user }, status }) } });
  const boundary = load<any>("components/auth/account-scope-boundary.tsx").AccountScopeBoundary;
  const props = { scope: getAccountScope(a), children: "PRIVATE ACCOUNT DETAILS" };
  assert.equal(boundary(props), props.children);
  status = "loading";
  assert.equal(boundary(props), props.children);
  user = b;
  assert.notEqual(boundary(props), props.children);
});

function elements(tree: any): any[] {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}

test("the actual page boundary and root compose exactly one NextAuth SessionProvider", () => {
  const marker = () => null;
  const load = createSourceLoader({ "next-auth/react": { SessionProvider: marker } });
  const boundary = load<any>("components/auth/session-boundary.tsx").SessionBoundary;
  const providers = load<any>("app/providers.tsx").Providers;
  const tree = providers({ children: boundary({ session: { user: a }, children: "private" }) });
  assert.equal(elements(tree).filter((element) => element.type === marker).length, 1);
});

test("both workspace composers use the workspace operation owner, not their disposable form owner", () => {
  const capture = () => { throw new Error("No request should be dispatched by rendering"); };
  const load = createSourceLoader({
    react: { ...React, useState: (initial: any) => [typeof initial === "function" ? initial() : initial, () => {}], useRef: (value: any) => ({ current: value }), useEffect: () => {}, useLayoutEffect: () => {}, useMemo: (fn: any) => fn() },
    "next-auth/react": { useSession: () => ({ data: { user: a }, status: "authenticated" }) },
    "@/lib/use-account-operation": { useAccountOperation: () => ({ accountScope: getAccountScope(a), capture }) },
    "@/components/blocks/app-toast-provider": { useToast: () => ({ showToast: () => {} }) },
  });
  const workspace = load<any>("components/blocks/media-creation-workspace.tsx").MediaCreationWorkspace;
  for (const initialType of ["image", "video"]) {
    const wrapper = workspace({ initialType });
    const tree = wrapper.type(wrapper.props);
    const form = elements(tree).find((element) => element.props?.variant === "composer");
    assert.ok(form);
    assert.equal(form.props.captureGeneration, capture);
  }
});
