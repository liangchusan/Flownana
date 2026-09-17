import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";

function setup({ signedIn = true, matches = true, assetExists = true, disappears = false, inspectFails = false, ownershipFails = false } = {}) {
  let reads = 0, downloads = 0, ownershipChecks = 0;
  const createdAt = new Date("2026-09-01T00:00:00Z");
  const load = createSourceLoader({
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "next-auth": { getServerSession: async () => signedIn ? { user: { id: "owner", accountCreatedAt: createdAt.toISOString() } } : null },
    "@/lib/auth-options": { authOptions: {} },
    "@/lib/account-scope": { matchesRequestAccount: () => matches },
    "@/lib/prisma": { prisma: { user: { findUnique: async () => ({ createdAt }) }, generation: { findFirst: async () => { reads++; return assetExists && !(disappears && reads > 1) ? { id: "asset" } : null; } } } },
    "@/lib/media-assets": { persistOrReuseMediaInput: async ({ source }: { source: string }) => { ownershipChecks++; if (ownershipFails) throw new Error("not owned"); return { url: source }; } },
    "@/lib/inspect-reference": { inspectReference: async () => { downloads++; if (inspectFails) throw new Error("corrupt bytes"); return { kind: "video", contentType: "video/mp4", sizeBytes: 1024, durationSeconds: 6 }; } },
  });
  const { POST } = load<{ POST: (request: Request) => Promise<Response> }>("app/api/creations/inspect/route.ts");
  return { request: (asset = true) => POST(new Request("https://app.test/api/creations/inspect", { method: "POST", body: JSON.stringify({ url: "https://media.test/owned.mp4", kind: "video", asset }) })), counts: () => ({ reads, downloads, ownershipChecks }) };
}

test("reference inspection denies anonymous, stale-account, deleted and unowned media before download", async () => {
  for (const config of [{ signedIn: false }, { matches: false }, { assetExists: false }, { ownershipFails: true }]) {
    const harness = setup(config); const response = await harness.request();
    assert.ok(response.status >= 400); assert.equal(harness.counts().downloads, 0);
  }
});
test("reference inspection returns verified metadata and checks deletion again after reading", async () => {
  const valid = setup(); const response = await valid.request();
  assert.equal(response.status, 200); assert.equal((await response.json()).durationSeconds, 6);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(valid.counts().reads, 2);
  assert.equal((await setup({ disappears: true }).request()).status, 409);
  assert.equal((await setup({ inspectFails: true }).request()).status, 400);
});
test("uploaded references still require ownership even without an Assets generation", async () => {
  const upload = setup({ assetExists: false }); assert.equal((await upload.request(false)).status, 200);
  assert.deepEqual(upload.counts(), { reads: 0, downloads: 1, ownershipChecks: 1 });
  const invalid = setup({ ownershipFails: true }); assert.equal((await invalid.request(false)).status, 400);
  assert.equal(invalid.counts().downloads, 0);
});

test("deleted output kept alive by old references cannot be used for another paid generation", async () => {
  let debits = 0;
  const createdAt = new Date("2026-09-01T00:00:00Z");
  const tx = {
    $queryRaw: async () => [], user: { findUnique: async () => ({ createdAt }) },
    generation: { count: async () => 0, findFirst: async () => null },
    mediaAsset: { findUnique: async () => ({ type: "image", origin: "generated", url: "https://media.test/deleted.png" }) },
  };
  const load = createSourceLoader({
    "@/lib/prisma": { prisma: { $transaction: async (run: (db: unknown) => unknown) => run(tx) } },
    "@/lib/credit-consumption": { consumeCreditsFIFOWithClient: async () => { debits++; return []; } },
    "@/lib/media-assets": { syncGenerationMediaAssets: async () => undefined },
  });
  const { reserveGeneration } = load<any>("lib/generation-lifecycle.ts");
  await assert.rejects(reserveGeneration({ account: { id: "owner", accountCreatedAt: createdAt.toISOString() }, type: "image", prompt: "Test", modelOptionId: "fixture", creditsCost: 2, parameters: {}, inputs: [{ media: { url: "https://media.test/deleted.png" }, type: "image", role: "input", position: 0 }] }));
  assert.equal(debits, 0);
});
