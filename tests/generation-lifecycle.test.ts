import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { createSourceLoader } from "./helpers/load-source.ts";
import { isolatedTestDatabase } from "./helpers/test-database.ts";
import type { GenerationMediaAsset } from "../lib/media-assets";

type Lifecycle = typeof import("../lib/generation-lifecycle");
const databaseUrl = process.env.FLOWNANA_TEST_DATABASE_URL;

test("generation lifecycle uses real isolated PostgreSQL transactions", { skip: !databaseUrl }, async (t) => {
  const db = isolatedTestDatabase(databaseUrl!);
  t.after(() => db.$disconnect());
  const load = createSourceLoader({ "@/lib/prisma": { prisma: db } });
  const lifecycle = load<Lifecycle>("lib/generation-lifecycle.ts");

  async function fixture() {
    const id = `generation_test_${randomUUID()}`;
    const user = await db.user.create({ data: { id, email: `${id}@example.test` } });
    const account = { id, accountCreatedAt: user.createdAt.toISOString() };
    const batch = await db.creditBatch.create({ data: {
      userId: id, amount: 100, remaining: 100, expiresAt: new Date(Date.now() + 86_400_000), source: "isolated_test",
    } });
    return {
      account, batch,
      reserve: (type: "image" | "video" = "image", inputs: GenerationMediaAsset[] = []) => lifecycle.reserveGeneration({
        account, type, prompt: "Fixture", modelOptionId: "fixture_model", creditsCost: 2,
        parameters: { runId: "client_value", outputCount: 4 }, inputs,
      }),
      balance: async () => (await db.creditBatch.findUniqueOrThrow({ where: { id: batch.id } })).remaining,
      cleanup: () => db.user.deleteMany({ where: { id } }),
    };
  }

  await t.test("twelve mixed outputs reserve only five slots, debits and provider dispatches", async () => {
    const f = await fixture();
    try {
      let dispatched = 0;
      const results = await Promise.allSettled(Array.from({ length: 12 }, async (_, index) => {
        const reserved = await f.reserve(index % 2 ? "video" : "image");
        dispatched++;
        return reserved;
      }));
      assert.equal(dispatched, 5);
      assert.equal(await f.balance(), 90);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 5);
      for (const result of results) {
        if (result.status === "rejected") assert.equal(result.reason.errorCode, "rate_limited");
        else {
          assert.equal(result.value.status, "pending");
          assert.equal(result.value.taskId, null);
          assert.deepEqual(result.value.creditConsumption, [{ batchId: f.batch.id, amount: 2 }]);
        }
      }
    } finally { await f.cleanup(); }
  });

  await t.test("four images and one video fill the shared cap; client group metadata is not multiplied", async () => {
    const f = await fixture();
    try {
      await Promise.all(Array.from({ length: 4 }, () => f.reserve()));
      await f.reserve("video");
      await assert.rejects(f.reserve(), (error: unknown) => (error as { errorCode: string }).errorCode === "rate_limited");
      assert.equal(await f.balance(), 90);
    } finally { await f.cleanup(); }
  });

  await t.test("owned inputs are linked at reservation and a deleted input cannot debit credits", async () => {
    const f = await fixture();
    try {
      const media = { url: `https://example.test/${f.account.id}.png`, contentType: "image/png", sizeBytes: 1024 };
      const asset = await db.mediaAsset.create({ data: { userId: f.account.id, type: "image", origin: "uploaded", ...media } });
      const input: GenerationMediaAsset = { media, type: "image", role: "input", position: 0 };
      const reserved = await f.reserve("video", [input]);
      assert.equal(await db.generationMedia.count({ where: { generationId: reserved.id, role: "input" } }), 1);
      assert.equal(await f.balance(), 98);
      await db.mediaAsset.delete({ where: { id: asset.id } });
      await assert.rejects(f.reserve("video", [input]));
      assert.equal(await f.balance(), 98);
    } finally { await f.cleanup(); }
  });

  await t.test("history restores repeated typed inputs in their submitted order despite unique asset relations", async () => {
    const f = await fixture();
    try {
      const first = { url: `https://example.test/${f.account.id}.png`, contentType: "image/png", sizeBytes: 1024 };
      const second = { url: `https://example.test/${f.account.id}.mp4`, contentType: "video/mp4", sizeBytes: 1024 };
      await db.mediaAsset.createMany({ data: [{ userId: f.account.id, type: "image", origin: "uploaded", ...first }, { userId: f.account.id, type: "video", origin: "uploaded", ...second }] });
      const reserved = await f.reserve("video", [
        { media: first, role: "input", type: "image", position: 0 },
        { media: second, role: "input", type: "video", position: 1 },
        { media: first, role: "input", type: "image", position: 2 },
      ]);
      assert.equal(await db.generationMedia.count({ where: { generationId: reserved.id, role: "input" } }), 2);
      const { getCreationHistory } = load<typeof import("../lib/creations")>("lib/creations.ts");
      const rows = await getCreationHistory({ userId: f.account.id, accountCreatedAt: f.account.accountCreatedAt });
      assert.deepEqual(rows[0].inputUrls, [first.url, second.url, first.url]);
      assert.deepEqual(rows[0].parameters?.inputKinds, ["image", "video", "image"]);
    } finally { await f.cleanup(); }
  });

  await t.test("input-link failure rolls back both reservation and debit", async () => {
    const f = await fixture();
    try {
      const media = { url: `https://example.test/${f.account.id}.png` };
      await db.mediaAsset.create({ data: { userId: f.account.id, type: "image", origin: "uploaded", ...media } });
      const failing = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@/lib/media-assets": {
        syncGenerationMediaAssets: async () => { throw new Error("link failed"); },
      } })<Lifecycle>("lib/generation-lifecycle.ts");
      await assert.rejects(failing.reserveGeneration({ account: f.account, type: "image", prompt: "Fixture",
        modelOptionId: "fixture_model", creditsCost: 2, parameters: {},
        inputs: [{ media, type: "image", role: "input", position: 0 }],
      }), /link failed/);
      assert.equal(await f.balance(), 100);
      assert.equal(await db.generation.count({ where: { userId: f.account.id } }), 0);
    } finally { await f.cleanup(); }
  });

  await t.test("crash before provider ID is recoverable; concurrent failure retries refund once without extending expiry", async () => {
    const f = await fixture();
    try {
      const reserved = await f.reserve();
      await Promise.all(Array.from({ length: 10 }, () => lifecycle.failGeneration({
        account: f.account, id: reserved.id, error: { errorCode: "timeout" },
      })));
      assert.equal(await f.balance(), 100);
      const settled = await db.generation.findUniqueOrThrow({ where: { id: reserved.id } });
      assert.equal(settled.status, "failed");
      assert.equal(settled.creditConsumption, null);
      assert.equal((await db.creditBatch.findUniqueOrThrow({ where: { id: f.batch.id } })).expiresAt.toISOString(), f.batch.expiresAt.toISOString());
      const attached = await lifecycle.attachGenerationTask(f.account, reserved.id, "late_provider_id");
      assert.equal(attached.status, "failed");
      assert.equal(attached.taskId, null);
    } finally { await f.cleanup(); }
  });

  await t.test("success and failure race to one terminal state and one credit outcome", async () => {
    const f = await fixture();
    try {
      const reserved = await f.reserve("video");
      await lifecycle.attachGenerationTask(f.account, reserved.id, `task_${randomUUID()}`);
      const output: GenerationMediaAsset = { media: { url: `https://example.test/${reserved.id}.mp4` }, type: "video", role: "output", position: 0 };
      await Promise.all([
        lifecycle.completeGeneration({ account: f.account, id: reserved.id, output }),
        lifecycle.failGeneration({ account: f.account, id: reserved.id, error: { errorCode: "timeout" } }),
      ]);
      const winner = await db.generation.findUniqueOrThrow({ where: { id: reserved.id } });
      assert.equal(winner.creditConsumption, null);
      assert.equal(await f.balance(), winner.status === "success" ? 98 : 100);
      assert.equal(winner.urls.length, winner.status === "success" ? 1 : 0);
      assert.equal(await db.generationMedia.count({ where: { generationId: reserved.id, role: "output" } }), winner.status === "success" ? 1 : 0);
    } finally { await f.cleanup(); }
  });

  await t.test("a transaction commit failure retains the refund snapshot for later recovery", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      const reserved = await f.reserve();
      let inject = true;
      const proxy = new Proxy(db, { get(target, property) {
        if (property !== "$transaction") return Reflect.get(target, property);
        return (callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) =>
          target.$transaction(async (tx) => {
            const result = await callback(tx);
            if (inject) { inject = false; throw new Error("commit failed"); }
            return result;
          }, options);
      } });
      const failing = createSourceLoader({ "@/lib/prisma": { prisma: proxy } })<Lifecycle>("lib/generation-lifecycle.ts");
      const result = await failing.failGeneration({ account: f.account, id: reserved.id, error: { errorCode: "timeout" } });
      assert.equal(result.refundPending, true);
      assert.deepEqual(result.generation.creditConsumption, reserved.creditConsumption);
      assert.equal(await f.balance(), 98);
      await lifecycle.recoverFailedGenerations(f.account);
      assert.equal(await f.balance(), 100);
      assert.equal((await db.generation.findUniqueOrThrow({ where: { id: reserved.id } })).creditConsumption, null);
    } finally { await f.cleanup(); }
  });

  await t.test("malformed stored refund entries are not partially applied or discarded", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      const reserved = await f.reserve();
      const malformed = [{ batchId: f.batch.id, amount: 2 }, { batchId: "bad", amount: -1 }];
      await db.generation.update({ where: { id: reserved.id }, data: { creditConsumption: malformed } });
      const result = await lifecycle.failGeneration({ account: f.account, id: reserved.id, error: { errorCode: "timeout" } });
      assert.equal(result.refundPending, true);
      assert.deepEqual(result.generation.creditConsumption, malformed);
      assert.equal(await f.balance(), 98);
    } finally { await f.cleanup(); }
  });

  await t.test("a stale authenticated request cannot reserve against a recreated account", async () => {
    const f = await fixture();
    try {
      await db.user.update({ where: { id: f.account.id }, data: { createdAt: new Date(Date.now() + 1000) } });
      await assert.rejects(f.reserve(), (error: unknown) => (error as { errorCode: string }).errorCode === "auth_required");
      assert.equal(await f.balance(), 100);
    } finally { await f.cleanup(); }
  });

  await t.test("a mismatched refund total stays pending instead of granting a partial credit", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      const reserved = await f.reserve();
      const malformed = [{ batchId: f.batch.id, amount: 1 }];
      await db.generation.update({ where: { id: reserved.id }, data: { creditConsumption: malformed } });
      const result = await lifecycle.failGeneration({ account: f.account, id: reserved.id, error: { errorCode: "timeout" } });
      assert.equal(result.refundPending, true);
      assert.deepEqual(result.generation.creditConsumption, malformed);
      assert.equal(await f.balance(), 98);
    } finally { await f.cleanup(); }
  });

  await t.test("storage leases serialize attempts, survive process loss and fence an expired worker", async () => {
    const f = await fixture();
    const deleted: string[] = [];
    const controlled = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@vercel/blob": {
      del: async (paths: string[]) => { deleted.push(...paths); },
    } })<Lifecycle>("lib/generation-lifecycle.ts");
    process.env.BLOB_READ_WRITE_TOKEN = "isolated_fixture_not_a_token";
    try {
      const reserved = await f.reserve("video");
      const claims = await Promise.all(Array.from({ length: 12 }, () => controlled.claimGenerationOutput(f.account, reserved.id)));
      assert.equal(claims.filter((claim) => claim.attemptId).length, 1);
      const first = claims.find((claim) => claim.attemptId)!;
      const pathname = `generations/${f.account.id}/video/fixture-${randomUUID()}.mp4`;
      await controlled.recordGenerationOutputPath(f.account, reserved.id, first.attemptId!, pathname);
      await controlled.recoverGenerationOutputCleanup(f.account);
      assert.deepEqual(deleted, []);
      const current = await db.generation.findUniqueOrThrow({ where: { id: reserved.id } });
      const saved = current.parameters as { outputStorage: { id: string; expiresAt: number; pathname: string } };
      await db.generation.update({ where: { id: reserved.id }, data: {
        parameters: { ...saved, outputStorage: { ...saved.outputStorage, expiresAt: 0 } },
      } });
      await controlled.recoverGenerationOutputCleanup(f.account);
      assert.deepEqual(deleted, [pathname]);
      const output: GenerationMediaAsset = { media: { url: `https://fixture.public.blob.vercel-storage.com/${pathname}`, pathname },
        type: "video", role: "output", position: 0 };
      const late = await controlled.completeGeneration({ account: f.account, id: reserved.id, attemptId: first.attemptId!, output });
      assert.equal(late.accepted, false);
      const next = await controlled.claimGenerationOutput(f.account, reserved.id);
      assert.ok(next.attemptId);
      const failure = await controlled.failGeneration({ account: f.account, id: reserved.id, attemptId: first.attemptId!, error: { errorCode: "timeout" } });
      assert.equal(failure.generation.status, "pending");
      assert.equal(failure.creditsRefunded, false);
      assert.equal(await f.balance(), 98);
    } finally { await f.cleanup(); }
  });
});
