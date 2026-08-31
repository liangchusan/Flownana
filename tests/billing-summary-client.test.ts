import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";
import { ACCOUNT_SCOPE_HEADER, getAccountScope } from "../lib/account-scope.ts";

const accountA = getAccountScope({ id: "A", accountCreatedAt: "2026-08-31T00:00:00.000Z" })!;
const accountB = getAccountScope({ id: "B", accountCreatedAt: "2026-08-31T00:00:00.000Z" })!;
const payload = (scope: string, current = 100) => ({ accountScope: scope, subscription: null, credits: { current } });

function fixture(t: TestContext) {
  const storage = new Map<string, string>();
  const listeners: Array<(event: { key: string | null; newValue: string | null }) => void> = [];
  let rejectWrites = false;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    addEventListener: (_event: string, listener: typeof listeners[number]) => listeners.push(listener),
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { if (rejectWrites) throw new Error("Storage disabled"); storage.set(key, value); },
      removeItem: (key: string) => { if (rejectWrites) throw new Error("Storage disabled"); storage.delete(key); },
    },
  } });
  t.after(() => Reflect.deleteProperty(globalThis, "window"));
  const client = createSourceLoader({})<typeof import("../lib/billing-summary-client")>("lib/billing-summary-client.ts");
  return { client, storage, rejectWrites: () => { rejectWrites = true; },
    emit: (key: string) => listeners.forEach((listener) => listener({ key, newValue: null })),
  };
}

test("billing requests and caches are isolated by account scope and deduplicate the same account", async (t) => {
  const { client } = fixture(t);
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const scope = new Headers(init.headers).get(ACCOUNT_SCOPE_HEADER)!;
    calls.push(scope);
    return Response.json(payload(scope));
  });
  const first = client.fetchBillingSummary(accountA);
  assert.equal(client.fetchBillingSummary(accountA), first);
  await first;
  assert.equal(client.getCachedBillingSummary(accountB), null);
  await client.fetchBillingSummary(accountB);
  assert.deepEqual(calls, [accountA, accountB]);
  assert.equal(client.getCachedBillingSummary(null), null);
});

test("a Cookie account change cannot label another account response as the captured caller", async (t) => {
  const { client } = fixture(t);
  t.mock.method(globalThis, "fetch", async () => Response.json(payload(accountB)));
  assert.equal(await client.fetchBillingSummary(accountA), null);
  assert.equal(client.getCachedBillingSummary(accountA), null);
});

test("clear fences late requests and an old finally cannot remove a new in-flight request", async (t) => {
  const { client } = fixture(t);
  const resolve: Array<(response: Response) => void> = [];
  t.mock.method(globalThis, "fetch", () => new Promise<Response>((done) => { resolve.push(done); }));
  const old = client.fetchBillingSummary(accountA);
  client.clearCachedBillingSummary();
  const current = client.fetchBillingSummary(accountA);
  resolve[0](Response.json(payload(accountA, 1)));
  assert.equal(await old, null);
  assert.equal(client.getCachedBillingSummary(accountA), null);
  assert.equal(client.fetchBillingSummary(accountA), current);
  resolve[1](Response.json(payload(accountA, 2)));
  assert.equal((await current)?.credits.current, 2);
  assert.equal(resolve.length, 2);
});

test("storage failures never prevent cache clearing or a usable network response", async (t) => {
  const f = fixture(t);
  t.mock.method(globalThis, "fetch", async () => Response.json(payload(accountA)));
  await f.client.fetchBillingSummary(accountA);
  f.rejectWrites();
  assert.doesNotThrow(() => f.client.clearCachedBillingSummary());
  // Failed removeItem must not make the old persisted value immediately valid again.
  assert.equal(f.client.getCachedBillingSummary(accountA), null);
  assert.equal((await f.client.fetchBillingSummary(accountA))?.credits.current, 100);
});

test("cross-tab invalidation also fences requests that are already running", async (t) => {
  const f = fixture(t);
  let resolve!: (response: Response) => void;
  t.mock.method(globalThis, "fetch", () => new Promise<Response>((done) => { resolve = done; }));
  const pending = f.client.fetchBillingSummary(accountA);
  f.emit("nextauth.message");
  resolve(Response.json(payload(accountA)));
  assert.equal(await pending, null);
  assert.equal(f.client.getCachedBillingSummary(accountA), null);
});

test("unscoped, malformed, mismatched and future-dated persisted summaries are ignored", (t) => {
  const { client, storage } = fixture(t);
  storage.set("flownana_billing_summary_cache_v1", JSON.stringify({ summary: payload(accountA), cachedAt: Date.now() }));
  assert.equal(client.getCachedBillingSummary(accountA), null);
  for (const value of [
    { scope: accountB, summary: payload(accountB), cachedAt: Date.now() },
    { scope: accountA, summary: payload(accountB), cachedAt: Date.now() },
    { scope: accountA, summary: payload(accountA), cachedAt: Date.now() + 60_000 },
    { scope: accountA, summary: {}, cachedAt: Date.now() },
  ]) {
    storage.set("flownana_billing_summary_cache_v2", JSON.stringify(value));
    assert.equal(client.getCachedBillingSummary(accountA), null);
  }
});
