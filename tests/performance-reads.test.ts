import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";
import { initialHistoryRefreshDelay } from "../lib/history-refresh.ts";

test("server history seeds expire and do not trust future clock timestamps", () => {
  assert.equal(initialHistoryRefreshDelay(undefined, 50_000), 0);
  assert.equal(initialHistoryRefreshDelay(45_000, 50_000), 5_000);
  assert.equal(initialHistoryRefreshDelay(40_000, 50_000), 0);
  assert.equal(initialHistoryRefreshDelay(50_001, 50_000), 0);
  assert.equal(initialHistoryRefreshDelay(NaN, 50_000), 0);
});

test("Agent read coalescing preserves cancellation, account isolation and mutation freshness", async t => {
  const responses: Array<{ resolve: (value: Response) => void; signal: AbortSignal }> = [];
  t.mock.method(globalThis, "fetch", (_url: unknown, options: RequestInit) =>
    new Promise<Response>(resolve => responses.push({ resolve, signal: options.signal! })));
  const { fetchAgentSnapshot, invalidateAgentReads } = createSourceLoader({})<typeof import("../lib/shared-agent-read")>("lib/shared-agent-read.ts");
  const controller = new AbortController();
  const first = fetchAgentSnapshot("account-a:epoch-1", undefined, controller.signal);
  const second = fetchAgentSnapshot("account-a:epoch-1");
  assert.equal(responses.length, 1);
  const cancelled = assert.rejects(first, { name: "AbortError" });
  controller.abort();
  await cancelled;
  assert.equal(responses[0].signal.aborted, false, "one subscriber must not cancel another");
  responses[0].resolve(Response.json({ accountScope: "account-a:epoch-1", conversations: [] }));
  assert.equal((await second).ok, true);

  const oldEpoch = fetchAgentSnapshot("account-a:epoch-1");
  const newEpoch = fetchAgentSnapshot("account-a:epoch-2");
  const otherAccount = fetchAgentSnapshot("account-b:epoch-1");
  assert.equal(responses.length, 4, "no completed cache, and no cross-account coalescing");
  for (let index = 1; index < 4; index++) responses[index].resolve(Response.json({ conversations: [] }));
  await Promise.all([oldEpoch, newEpoch, otherAccount]);

  const stale = fetchAgentSnapshot("account-a:epoch-1");
  const rejectsStale = assert.rejects(stale, { name: "AbortError" });
  invalidateAgentReads();
  const fresh = fetchAgentSnapshot("account-a:epoch-1");
  assert.equal(responses.length, 6);
  assert.equal(responses[4].signal.aborted, true);
  responses[4].resolve(Response.json({ conversations: [{ title: "Old title" }] }));
  responses[5].resolve(Response.json({ conversations: [{ title: "New title" }] }));
  await rejectsStale;
  assert.equal((await fresh).data.conversations[0].title, "New title");

  const solo = new AbortController();
  const abandoned = fetchAgentSnapshot("account-a:epoch-1", "conversation", solo.signal);
  const rejectsAbandoned = assert.rejects(abandoned, { name: "AbortError" });
  solo.abort();
  assert.equal(responses[6].signal.aborted, true);
  responses[6].resolve(Response.json({}));
  await rejectsAbandoned;
});

test("timing spans remain isolated between concurrent requests and retain error status", async t => {
  const logs: string[] = [];
  t.mock.method(console, "info", (message: string) => { logs.push(message); });
  const { timedResponse, measureRequestStage } = createSourceLoader({})<typeof import("../lib/request-timing")>("lib/request-timing.ts");
  const [first, second] = await Promise.all([
    timedResponse("/api/creations", async () => {
      await measureRequestStage("history", async () => Promise.resolve());
      return Response.json({ privateField: "not logged" });
    }),
    timedResponse("/api/agent", async () => {
      await measureRequestStage("auth", async () => Promise.resolve());
      return Response.json({}, { status: 401 });
    }),
  ]);
  assert.match(first.headers.get("Server-Timing")!, /history;dur=/);
  assert.doesNotMatch(first.headers.get("Server-Timing")!, /auth;dur=/);
  assert.match(second.headers.get("Server-Timing")!, /auth;dur=/);
  assert.notEqual(first.headers.get("X-Request-Id"), second.headers.get("X-Request-Id"));
  await assert.rejects(timedResponse("/api/creations", async () => { throw new Error("private error"); }));
  assert.equal(JSON.parse(logs.at(-1)!).status, 500);
  assert.ok(logs.every(log => !log.includes("private")));
});
