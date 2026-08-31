import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import * as React from "react";
import { createSourceLoader } from "./helpers/load-source.ts";

function elements(tree: any): any[] {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}

function fixture(t: TestContext, post: () => Promise<unknown>, read?: () => Promise<unknown>) {
  const events: string[] = [], notices: any[] = [], success: unknown[] = [], failures: any[] = [], uncertain: any[] = [], tasks: any[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout: () => 0 } });
  t.after(() => Reflect.deleteProperty(globalThis, "window"));
  t.mock.method(globalThis, "setTimeout", ((fn: () => void) => { queueMicrotask(fn); return 0; }) as any);
  const load = createSourceLoader({
    react: { ...React, useState: (initial: any) => [typeof initial === "function" ? initial() : initial, () => {}], useRef: (initial: any) => ({ current: initial }), useMemo: (fn: any) => fn(), useEffect: () => {} },
    "react-dropzone": { useDropzone: () => ({ getRootProps: () => ({}), getInputProps: () => ({}), isDragActive: false }) },
    axios: { post, get: read },
    "next-auth/react": { useSession: () => ({ data: { user: { id: "fixture" } }, status: "authenticated" }) },
    "@/lib/use-account-operation": { useAccountOperation: () => ({ accountScope: "fixture", capture: () => ({ headers: {}, signal: new AbortController().signal, assertCurrent: () => {} }) }) },
    "@/lib/analytics": { trackEvent: (event: string) => events.push(event) },
    "@/components/blocks/app-toast-provider": { useToast: () => ({ showToast: (notice: any) => notices.push(notice) }) },
  });
  const run = async (type: "image" | "video") => {
    const component = type === "image" ? load<any>("components/generate/generate-form.tsx").GenerateForm : load<any>("components/creation/video-creation-form.tsx").VideoCreationForm;
    const tree = component({ initialPrompt: "Test prompt", variant: "composer", onGenerate: (...args: any[]) => success.push(args), onGenerationFailure: (value: any) => failures.push(value), onGenerationUncertain: (value: any) => uncertain.push(value), onGenerationTaskCreated: (value: any) => tasks.push(value), setIsGenerating: () => {} });
    const button = elements(tree).find((node) => node.props?.onClick?.name === "handleGenerate");
    assert.ok(button);
    await button.props.onClick();
  };
  return { run, events, notices, success, failures, uncertain, tasks };
}

test("actual image form treats a pending reply as accepted, never successful", async (t) => {
  const f = fixture(t, async () => ({ data: { success: true, pending: true, taskId: "reserved" } }));
  await f.run("image");
  assert.equal(f.tasks.length, 1);
  assert.equal(f.success.length, 0);
  assert.equal(f.failures.length, 0);
  assert.deepEqual(f.events, ["generation_started"]);
});

test("both real forms report a lost POST reply as unknown without false failure or resubmission", async (t) => {
  let posts = 0;
  const f = fixture(t, async () => { posts++; throw new Error("Network Error"); });
  await f.run("image"); await f.run("video");
  assert.equal(posts, 2);
  assert.equal(f.uncertain.length, 2);
  assert.equal(f.failures.length, 0);
  assert.ok(f.events.every((event) => event === "generation_started"));
  assert.ok(f.notices.every((notice) => notice.title === "Status unavailable" && !/returned|refund/i.test(notice.message)));
});

test("actual video form tolerates transient polling but preserves confirmed refund-pending failure", async (t) => {
  let reads = 0;
  const f = fixture(t, async () => ({ data: { success: true, pending: true, taskId: "task" } }), async () => {
    if (++reads === 1) throw new Error("Network Error");
    throw { response: { status: 503, data: { status: "failed", generationId: "generation", errorCode: "provider_unavailable", error: "The model could not complete this request. Your credits could not be returned automatically.", refundPending: true } } };
  });
  await f.run("video");
  assert.equal(reads, 2);
  assert.equal(f.failures.length, 1);
  assert.match(f.notices[0].message, /contact support/);
  assert.deepEqual(f.events, ["generation_started", "generation_failed"]);
});
