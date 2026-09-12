import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createSourceLoader } from "./helpers/load-source.ts";

function elements(tree: any): any[] {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}
const hooks = {
  ...React,
  useState: (initial: any) => [typeof initial === "function" ? initial() : initial, () => {}],
  useRef: (value: any) => ({ current: value }),
  useEffect: () => {},
  useLayoutEffect: () => {},
  useMemo: (fn: any) => fn(),
};
const user = { id: "test-home", accountCreatedAt: "2026-09-10T00:00:00.000Z", name: "Test" };

test("home footer appears only after the session is confirmed anonymous", () => {
  let status = "loading";
  const Footer = () => null;
  const load = createSourceLoader({
    react: hooks,
    "next-auth/react": { useSession: () => ({ status, data: status === "authenticated" ? { user } : null }) },
    "next/navigation": { useRouter: () => ({ push: () => undefined }), usePathname: () => "/" },
    "@/lib/use-account-operation": { useAccountOperation: () => ({ capture: () => {} }) },
    "@/components/blocks/app-toast-provider": { useToast: () => ({ showToast: () => {} }) },
    "@/components/layout/footer": { Footer },
  });
  const Home = load<any>("components/blocks/media-creation-workspace.tsx").MediaCreationWorkspace;
  for (const current of ["loading", "unauthenticated", "authenticated", "loading", "unauthenticated"]) {
    status = current;
    const scoped = Home({ initialType: "image" });
    const tree = scoped.type(scoped.props);
    const footers = elements(tree).filter((item) => item.type === Footer);
    assert.equal(footers.length, current === "unauthenticated" ? 1 : 0);
    if (footers.length) assert.equal(footers[0].props.variant, "light");
  }
});

test("account menu opens existing pricing and exposes mail and separate legal tabs", () => {
  let opened = 0;
  const stateChanges: unknown[] = [];
  let stateIndex = 0;
  const load = createSourceLoader({
    react: { ...hooks, useState: (initial: any) => [stateIndex++ === 0 ? true : typeof initial === "function" ? initial() : initial, (value: unknown) => stateChanges.push(value)] },
    "next-auth/react": { useSession: () => ({ data: { user }, status: "authenticated" }) },
    "@/components/pricing/pricing-modal-provider": { usePricingModal: () => ({ openPricing: () => opened++ }) },
    "@/lib/billing-summary-client": { getCachedBillingSummary: () => ({ credits: { current: 5 } }) },
  });
  const Menu = load<any>("components/layout/user-menu.tsx").UserMenu;
  const scoped = Menu({ user });
  const items = elements(scoped.type(scoped.props)).filter((item) => item.props?.role === "menuitem");
  const text = (item: any) => React.Children.toArray(item.props.children).filter((child) => typeof child === "string").join("").trim();
  assert.deepEqual(items.map(text), ["Account Profile", "Pricing", "Plans and Billing", "Contact Us", "Privacy Policy", "Terms of Service", "Sign Out"]);
  items[1].props.onClick();
  assert.equal(opened, 1);
  assert.equal(stateChanges.at(-1), false);
  assert.equal(items[3].props.href, "mailto:support@flownana.com");
  for (const [index, href] of [[4, "/privacy-policy"], [5, "/terms-of-service"]] as const) {
    assert.equal(items[index].props.href, href);
    assert.equal(items[index].props.target, "_blank");
    assert.match(items[index].props.rel, /noopener/);
  }
});

test("Home submits through the shared forms and navigates only after acceptance", (t) => {
  let location = new URL("https://www.flownana.com/");
  const navigations: string[] = [];
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    get location() { return location; },
    history: { state: { __NA: true }, pushState: (state: unknown, _title: string, url: URL) => {
      assert.equal(state, null, "Next must synchronize usePathname for external history updates");
      location = new URL(url); navigations.push(location.pathname);
    } },
  } });
  const Form = () => null;
  const load = createSourceLoader({
    react: hooks,
    "next-auth/react": { useSession: () => ({ data: { user }, status: "authenticated" }) },
    "next/navigation": { useRouter: () => ({ push: () => undefined }), usePathname: () => "/" },
    "@/lib/use-account-operation": { useAccountOperation: () => ({ capture: () => {} }) },
    "@/components/blocks/app-toast-provider": { useToast: () => ({ showToast: () => {} }) },
    "@/components/generate/generate-form": { GenerateForm: Form },
    "@/components/creation/video-creation-form": { VideoCreationForm: Form },
  });
  const Workspace = load<any>("components/blocks/media-creation-workspace.tsx").MediaCreationWorkspace;
  for (const type of ["image", "video"]) {
    location = new URL("https://www.flownana.com/");
    navigations.length = 0;
    const scope = Workspace({ initialType: type });
    const tree = scope.type(scope.props);
    const form = elements(tree).find((item) => item.type === Form);
    assert.ok(form);
    assert.equal(form.props.variant, "composer");
    form.props.toolbarLeading.props.onTypeChange(type);
    assert.deepEqual(navigations, []);
    form.props.onGenerationStart({ optimisticId: "run", prompt: "test", parameters: {} });
    form.props.onGenerationFailure({ optimisticId: "run", error: "Rejected" });
    assert.deepEqual(navigations, []);
    form.props.onGenerationTaskCreated({ optimisticId: "run", taskId: "task", outputIndex: 0 });
    assert.deepEqual(navigations, [`/${type}`]);
    form.props.onGenerationTaskCreated({ optimisticId: "run", taskId: "task-2", outputIndex: 1 });
    assert.deepEqual(navigations, [`/${type}`]);
  }
});
