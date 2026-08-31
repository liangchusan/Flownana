import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { createSourceLoader } from "./helpers/load-source.ts";
import { isolatedTestDatabase } from "./helpers/test-database.ts";
import { ACCOUNT_SCOPE_HEADER, getAccountScope } from "../lib/account-scope.ts";

type Lifecycle = typeof import("../lib/generation-lifecycle");
type Mutations = typeof import("../lib/creation-mutations");
type ImageRoute = typeof import("../app/api/generate/route");
type VideoRoute = typeof import("../app/api/veo/generate/route");
type CreationsRoute = typeof import("../app/api/creations/route");
type AccountRoute = typeof import("../app/api/account/route");
const databaseUrl = process.env.FLOWNANA_TEST_DATABASE_URL;

function request(path: string, body?: unknown, method = "POST") {
  const url = `http://localhost${path}`;
  return Object.assign(new Request(url, { method: body === undefined ? "GET" : method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
  }), { nextUrl: new URL(url) }) as NextRequest;
}

test("generation and deletion route boundaries with an isolated database", { skip: !databaseUrl }, async (t) => {
  const db = isolatedTestDatabase(databaseUrl!);
  t.after(() => db.$disconnect());
  process.env.BLOB_READ_WRITE_TOKEN = "isolated_fixture_not_a_token";

  async function fixture() {
    const id = `routes_test_${randomUUID()}`;
    const user = await db.user.create({ data: { id, email: `${id}@example.test` } });
    const account = { id, accountCreatedAt: user.createdAt.toISOString() };
    const batch = await db.creditBatch.create({ data: { userId: id, amount: 1000, remaining: 1000,
      expiresAt: new Date(Date.now() + 86_400_000), source: "isolated_test" } });
    const deleted: string[] = [];
    const persisted: string[] = [];
    const remoteReads: string[] = [];
    let loseUploadResponse = false;
    let onDelete: (() => Promise<void>) | undefined;
    const stripeSubs = new Map<string, Stripe.Subscription>();
    const cancellations: string[] = [];
    const load = createSourceLoader({
      "@/lib/prisma": { prisma: db }, "@/lib/auth-options": { authOptions: {} },
      "next-auth": { getServerSession: async () => ({ user: { ...user, ...account } }) },
      "next/server": { NextResponse: { json: Response.json } }, "@/lib/kie": { getKieApiKey: () => "fixture" },
      "@/lib/media-storage": { persistGeneratedMedia: async ({ taskId, kind, beforeUpload }: {
        taskId: string; kind: string; beforeUpload?: (pathname: string) => Promise<void>;
      }) => {
        const pathname = `generations/${id}/${kind}/${taskId}-${randomUUID()}.${kind === "image" ? "png" : "mp4"}`;
        await beforeUpload?.(pathname);
        persisted.push(pathname);
        if (loseUploadResponse) throw new Error("Upload response lost");
        return { url: `https://fixture.public.blob.vercel-storage.com/${pathname}`, pathname,
          contentType: kind === "image" ? "image/png" : "video/mp4", sizeBytes: 1024 };
      } },
      "@/lib/safe-remote-media": { safeRemoteMediaFetch: async ({ url }: { url: string }) => {
        remoteReads.push(url);
        return { url, contentType: "image/png", sizeBytes: 1024, body: Buffer.alloc(1024) };
      } },
      "@vercel/blob": { head: async () => ({ size: 1024, contentType: "image/png" }),
        del: async (urls: string | string[]) => { await onDelete?.(); deleted.push(...(Array.isArray(urls) ? urls : [urls])); },
      },
      "@/lib/stripe": { getStripe: () => ({ checkout: { sessions: { list: async () => ({ data: [], has_more: false }) } }, subscriptions: {
        list: () => ({ autoPagingToArray: async () => [...stripeSubs.values()].map((sub) => structuredClone(sub)) }),
        retrieve: async (subId: string) => {
          if (!stripeSubs.has(subId)) throw Object.assign(new Error("Missing subscription"), { code: "resource_missing" });
          return structuredClone(stripeSubs.get(subId)!);
        },
        cancel: async (subId: string) => { cancellations.push(subId); stripeSubs.get(subId)!.status = "canceled"; return structuredClone(stripeSubs.get(subId)!); },
      } }) },
    });
    const lifecycle = load<Lifecycle>("lib/generation-lifecycle.ts");
    const mutations = load<Mutations>("lib/creation-mutations.ts");
    const image = load<ImageRoute>("app/api/generate/route.ts");
    const video = load<VideoRoute>("app/api/veo/generate/route.ts");
    const creations = load<CreationsRoute>("app/api/creations/route.ts");
    const deletion = load<AccountRoute>("app/api/account/route.ts");
    const reserve = (type: "image" | "video" = "image") => lifecycle.reserveGeneration({
      account, type, prompt: "Fixture", modelOptionId: type === "image" ? "gpt-image-2-text-to-image" : "veo31_fast_8",
      creditsCost: 2, parameters: { model: "Fixture", runId: "shared-run" }, inputs: [],
    });
    const complete = async () => {
      const reserved = await reserve();
      const media = { url: `https://fixture.public.blob.vercel-storage.com/generations/${reserved.id}.png`, sizeBytes: 1024 };
      await lifecycle.completeGeneration({ account, id: reserved.id, output: { media, type: "image", role: "output", position: 0 } });
      return { reserved, media };
    };
    return { account, user, batch, deleted, persisted, remoteReads, lifecycle, mutations, image, video, creations, deletion, reserve, complete,
      loseUploadResponse: () => { loseUploadResponse = true; },
      stripeSubs, cancellations, setDelete: (callback: () => Promise<void>) => { onDelete = callback; },
      balance: async () => (await db.creditBatch.findUniqueOrThrow({ where: { id: batch.id } })).remaining,
      cleanup: () => db.user.deleteMany({ where: { id } }),
    };
  }

  await t.test("actual image/video POSTs dispatch at most five providers and persist before dispatch", { timeout: 5000 }, async (t) => {
    const f = await fixture();
    let release!: () => void;
    try {
      t.mock.method(console, "error", () => {});
      let calls = 0;
      let fiveStarted!: () => void;
      const started = new Promise<void>((resolve) => { fiveStarted = resolve; });
      let sevenRejected!: () => void;
      let rejectedCount = 0;
      const rejected = new Promise<void>((resolve) => { sevenRejected = resolve; });
      const gate = new Promise<void>((resolve) => { release = resolve; });
      t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("createTask")) {
          calls++;
          assert.ok(await db.generation.count({ where: { userId: f.account.id, status: "pending" } }) >= 1);
          const taskId = `task_${randomUUID()}`;
          if (calls === 5) fiveStarted();
          await gate;
          return Response.json({ code: 200, data: { taskId } });
        }
        return Response.json({ code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://example.test/output.png"] }) } });
      });
      const pending = Array.from({ length: 12 }, (_, index) => (index % 2
        ? f.video.POST(request("/api/veo/generate", { prompt: "Fixture", modelOptionId: "geminiomni_720_4", aspectRatio: "16:9" }))
        : f.image.POST(request("/api/generate", { prompt: "Fixture", model: "gpt-image-2", outputCount: 4 }))).then((response) => {
          if (response.status === 429 && ++rejectedCount === 7) sevenRejected();
          return response;
        }));
      // Hold the accepted five active until all remaining admissions reject.
      await Promise.all([started, rejected]);
      assert.equal(rejectedCount, 7);
      release();
      const results = await Promise.all(pending);
      assert.equal(calls, 5);
      assert.equal(results.filter((response) => response.ok).length, 5);
      const generations = await db.generation.findMany({ where: { userId: f.account.id } });
      assert.equal(generations.length, 5);
      assert.equal(await f.balance(), 1000 - generations.reduce((sum, gen) => sum + gen.creditsCost!, 0));
    } finally { release?.(); await f.cleanup(); }
  });

  await t.test("a stale browser account scope is rejected before generation or account deletion", async () => {
    const f = await fixture();
    try {
      const oldScope = getAccountScope({ ...f.account, accountCreatedAt: "2020-01-01T00:00:00.000Z" })!;
      const imageRequest = request("/api/generate", { prompt: "Fixture" });
      imageRequest.headers.set(ACCOUNT_SCOPE_HEADER, oldScope);
      assert.equal((await f.image.POST(imageRequest)).status, 401);
      const videoRequest = request("/api/veo/generate", { prompt: "Fixture", modelOptionId: "geminiomni_720_4" });
      videoRequest.headers.set(ACCOUNT_SCOPE_HEADER, oldScope);
      assert.equal((await f.video.POST(videoRequest)).status, 401);
      const deleteRequest = new Request("http://localhost/api/account", { method: "DELETE",
        headers: { [ACCOUNT_SCOPE_HEADER]: oldScope }, body: JSON.stringify({ confirmation: "DELETE" }) });
      assert.equal((await f.deletion.DELETE(deleteRequest)).status, 401);
      assert.equal(await db.generation.count({ where: { userId: f.account.id } }), 0);
      assert.equal(await f.balance(), 1000);
      assert.ok(await db.user.findUnique({ where: { id: f.account.id } }));
    } finally { await f.cleanup(); }
  });

  await t.test("provider creation failure leaves a durable failed reservation and refunded original batch", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      t.mock.method(globalThis, "fetch", async () => { throw new Error("network unavailable"); });
      const response = await f.image.POST(request("/api/generate", { prompt: "Fixture" }));
      assert.equal(response.ok, false);
      assert.equal((await response.json()).creditsRefunded, true);
      const generation = await db.generation.findFirstOrThrow({ where: { userId: f.account.id } });
      assert.equal(generation.status, "failed");
      assert.equal(generation.taskId, null);
      assert.equal(generation.creditConsumption, null);
      assert.equal(await f.balance(), 1000);
    } finally { await f.cleanup(); }
  });

  await t.test("video polling ignores client model overrides and refunds failed null-model history", async (t) => {
    const f = await fixture();
    try {
      const generation = await f.reserve("video");
      const attached = await f.lifecycle.attachGenerationTask(f.account, generation.id, `task_${randomUUID()}`);
      const urls: string[] = [];
      t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        urls.push(String(input)); return Response.json({ code: 200, data: { successFlag: 0 } });
      });
      const response = await f.video.GET(request(`/api/veo/generate?taskId=${attached.taskId}&modelOptionId=geminiomni_720_4`));
      assert.equal((await response.json()).pending, true);
      assert.ok(urls[0].includes("/api/v1/veo/record-info"));
      await db.generation.update({ where: { id: generation.id }, data: { status: "failed", modelOptionId: null, error: "Generation timeout" } });
      const failed = await f.video.GET(request(`/api/veo/generate?taskId=${attached.taskId}`));
      assert.equal((await failed.json()).creditsRefunded, true);
      assert.equal(urls.length, 1);
      assert.equal(await f.balance(), 1000);
    } finally { await f.cleanup(); }
  });

  await t.test("creation DELETE and arbitrary-url PATCH cannot destroy active reservations", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      const generation = await f.reserve();
      const deleted = await f.creations.DELETE(new Request(`http://localhost/api/creations?id=${generation.id}`, { method: "DELETE" }));
      assert.equal(deleted.status, 409);
      const patched = await f.creations.PATCH(request("/api/creations", { id: generation.id, action: "delete-media", url: "https://example.test/not-an-output" }, "PATCH"));
      assert.equal(patched.status, 409);
      assert.equal((await db.generation.findUniqueOrThrow({ where: { id: generation.id } })).status, "pending");
      assert.equal(await f.balance(), 998);
      assert.equal(f.deleted.length, 0);
    } finally { await f.cleanup(); }
  });

  await t.test("model limits and malformed settings reject before debit or provider dispatch", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      let calls = 0;
      t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("Provider must not be called"); });
      const media = await db.mediaAsset.create({ data: { userId: f.account.id, type: "image", origin: "uploaded",
        url: "https://fixture.public.blob.vercel-storage.com/large-input.png", contentType: "image/png", sizeBytes: 11 * 1024 * 1024 } });
      const large = await f.image.POST(request("/api/generate", { prompt: "Fixture", model: "qwen-image-3-pro", imageUrls: [media.url] }));
      assert.equal((await large.json()).errorCode, "file_too_large");
      for (const body of [[], { prompt: "Fixture", model: "constructor" }, { prompt: "Fixture", imageUrls: [1] }]) {
        assert.equal((await f.image.POST(request("/api/generate", body))).status, 400);
      }
      for (const body of [
        { prompt: "Fixture", modelOptionId: "veo31_fast_8" },
        { prompt: "Fixture", modelOptionId: "constructor" },
        { prompt: "Fixture", modelOptionId: "geminiomni_720_4", inputs: [{ url: media.url, kind: "unknown" }] },
      ]) assert.equal((await f.video.POST(request("/api/veo/generate", body))).status, 400);
      assert.equal(calls, 0);
      assert.equal(await f.balance(), 1000);
      assert.equal(await db.generation.count({ where: { userId: f.account.id } }), 0);
    } finally { await f.cleanup(); }
  });

  await t.test("concurrent video completion uploads only one output and returns the saved winner or pending", { timeout: 5000 }, async (t) => {
    const f = await fixture();
    let release!: () => void;
    try {
      const generation = await f.reserve("video");
      const attached = await f.lifecycle.attachGenerationTask(f.account, generation.id, `task_${randomUUID()}`);
      let calls = 0;
      const bothFetching = new Promise<void>((resolve) => { release = resolve; });
      t.mock.method(globalThis, "fetch", async () => {
        if (++calls === 2) release();
        await bothFetching;
        return Response.json({ code: 200, data: { successFlag: 1, response: { resultUrls: ["https://example.test/result.mp4"] } } });
      });
      const results = await Promise.all([1, 2].map(async () => {
        const response = await f.video.GET(request(`/api/veo/generate?taskId=${attached.taskId}`));
        assert.equal(response.status, 200);
        return response.json();
      }));
      assert.equal(calls, 2);
      const saved = await db.generation.findUniqueOrThrow({ where: { id: generation.id } });
      assert.equal(saved.status, "success");
      assert.equal(f.persisted.length, 1);
      for (const result of results) assert.ok(result.pending || result.videoUrl === saved.urls[0]);
      assert.equal(f.deleted.length, 0);
      assert.equal(await db.mediaAsset.count({ where: { userId: f.account.id } }), 1);
      assert.equal(await f.balance(), 998);
    } finally { release?.(); await f.cleanup(); }
  });

  await t.test("a saved Blob is cleaned after a completion transaction fails", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      t.mock.method(f.lifecycle, "completeGeneration", async () => { throw new Error("Database commit failed"); });
      t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => String(input).includes("createTask")
        ? Response.json({ code: 200, data: { taskId: `task_${randomUUID()}` } })
        : Response.json({ code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://example.test/result.png"] }) } }));
      const response = await f.image.POST(request("/api/generate", { prompt: "Fixture" }));
      assert.equal((await response.json()).creditsRefunded, true);
      assert.equal(f.persisted.length, 1);
      assert.deepEqual(f.deleted, f.persisted);
      assert.equal(await f.balance(), 1000);
    } finally { await f.cleanup(); }
  });

  await t.test("failed reservations with an unresolved refund cannot be deleted", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      const generation = await f.reserve();
      await db.generation.update({ where: { id: generation.id }, data: { status: "failed" } });
      const deleted = await f.creations.DELETE(new Request(`http://localhost/api/creations?id=${generation.id}`, { method: "DELETE" }));
      assert.equal(deleted.status, 409);
      assert.deepEqual((await db.generation.findUniqueOrThrow({ where: { id: generation.id } })).creditConsumption, generation.creditConsumption);
    } finally { await f.cleanup(); }
  });

  await t.test("an upload acknowledgement lost after put still leaves a recoverable pathname", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      f.loseUploadResponse();
      f.setDelete(async () => { throw new Error("Blob offline"); });
      t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => String(input).includes("createTask")
        ? Response.json({ code: 200, data: { taskId: `task_${randomUUID()}` } })
        : Response.json({ code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://example.test/result.png"] }) } }));
      const response = await f.image.POST(request("/api/generate", { prompt: "Fixture" }));
      assert.equal((await response.json()).creditsRefunded, true);
      const failed = await db.generation.findFirstOrThrow({ where: { userId: f.account.id } });
      assert.deepEqual(f.lifecycle.getPendingGenerationOutputPaths(f.account.id, failed.parameters), f.persisted);
      assert.equal(f.persisted.length, 1);
      assert.equal(f.deleted.length, 0);
      const saved = failed.parameters as { outputStorage: { id: string; expiresAt: number; pathname: string } };
      await db.generation.update({ where: { id: failed.id }, data: {
        parameters: { ...saved, outputStorage: { ...saved.outputStorage, expiresAt: 0 } },
      } });
      const deleted = await f.creations.DELETE(new Request(`http://localhost/api/creations?id=${failed.id}`, { method: "DELETE" }));
      assert.equal(deleted.status, 409);
      assert.ok(await db.generation.findUnique({ where: { id: failed.id } }));
      f.setDelete(async () => {});
      await f.creations.GET(new Request("http://localhost/api/creations"));
      assert.deepEqual(f.deleted, f.persisted);
      const retried = await db.generation.findUniqueOrThrow({ where: { id: failed.id } });
      assert.equal(retried.status, "failed");
      assert.deepEqual(f.lifecycle.getPendingGenerationOutputPaths(f.account.id, retried.parameters), []);
    } finally { await f.cleanup(); }
  });

  await t.test("a completion response loss cannot delete the committed output or refund it", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      const complete = f.lifecycle.completeGeneration;
      t.mock.method(f.lifecycle, "completeGeneration", async (...args: Parameters<typeof complete>) => {
        await complete(...args);
        throw new Error("Commit acknowledgement lost");
      });
      t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => String(input).includes("createTask")
        ? Response.json({ code: 200, data: { taskId: `task_${randomUUID()}` } })
        : Response.json({ code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://example.test/result.png"] }) } }));
      const response = await f.image.POST(request("/api/generate", { prompt: "Fixture" }));
      assert.equal((await response.json()).success, true);
      assert.equal(f.persisted.length, 1);
      assert.deepEqual(f.deleted, []);
      assert.equal(await f.balance(), 998);
    } finally { await f.cleanup(); }
  });

  await t.test("unavailable failure settlement reports unknown, not failed or refunded", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      t.mock.method(f.lifecycle, "failGeneration", async () => { throw new Error("Database unavailable"); });
      t.mock.method(globalThis, "fetch", async () => { throw new Error("Provider response lost"); });
      for (const [route, path, body] of [[f.image, "/api/generate", { prompt: "Fixture" }],
        [f.video, "/api/veo/generate", { prompt: "Fixture", modelOptionId: "geminiomni_720_4", aspectRatio: "16:9" }]] as const) {
        const response = await route.POST(request(path, body));
        const data = await response.json();
        assert.equal(response.status, 503); assert.equal(data.status, "unknown");
        assert.equal(data.pending, true); assert.equal(data.creditsRefunded, undefined); assert.equal(data.refundPending, undefined);
        assert.ok(data.generationId); assert.match(data.error, /history/);
        assert.equal((await db.generation.findUniqueOrThrow({ where: { id: data.generationId } })).status, "pending");
      }
    } finally { await f.cleanup(); }
  });

  await t.test("a lost reservation acknowledgement cannot claim rejection after a committed debit", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      const reserve = f.lifecycle.reserveGeneration;
      t.mock.method(f.lifecycle, "reserveGeneration", async (...args: Parameters<typeof reserve>) => {
        await reserve(...args); throw new Error("Reservation acknowledgement lost");
      });
      t.mock.method(globalThis, "fetch", async () => { assert.fail("No provider dispatch without a confirmed reservation"); });
      const data = await (await f.image.POST(request("/api/generate", { prompt: "Fixture" }))).json();
      assert.equal(data.status, "unknown"); assert.equal(data.generationId, undefined);
      assert.equal(await db.generation.count({ where: { userId: f.account.id, status: "pending" } }), 1);
      assert.equal(await f.balance(), 998);
    } finally { await f.cleanup(); }
  });

  await t.test("lost success acknowledgement plus unavailable reread never reports a saved output as failed", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      const complete = f.lifecycle.completeGeneration;
      t.mock.method(f.lifecycle, "completeGeneration", async (...args: Parameters<typeof complete>) => {
        await complete(...args); throw new Error("Commit acknowledgement lost");
      });
      t.mock.method(f.lifecycle, "failGeneration", async () => { throw new Error("Database unavailable"); });
      t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => String(input).includes("createTask")
        ? Response.json({ code: 200, data: { taskId: `task_${randomUUID()}` } })
        : Response.json({ code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://example.test/result.png"] }) } }));
      const data = await (await f.image.POST(request("/api/generate", { prompt: "Fixture" }))).json();
      assert.equal(data.status, "unknown"); assert.equal(data.refundPending, undefined);
      assert.equal((await db.generation.findUniqueOrThrow({ where: { id: data.generationId } })).status, "success");
      assert.equal(await f.balance(), 998); assert.deepEqual(f.deleted, []);
    } finally { await f.cleanup(); }
  });

  await t.test("owned legacy Provider references without size metadata use bounded remote validation", async (t) => {
    const f = await fixture();
    try {
      const media = await db.mediaAsset.create({ data: { userId: f.account.id, type: "image", origin: "generated",
        url: "https://example.test/legacy-provider.png" } });
      t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => String(input).includes("createTask")
        ? Response.json({ code: 200, data: { taskId: `task_${randomUUID()}` } })
        : Response.json({ code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://example.test/result.png"] }) } }));
      const response = await f.image.POST(request("/api/generate", { prompt: "Fixture", imageUrls: [media.url] }));
      assert.equal((await response.json()).success, true);
      assert.deepEqual(f.remoteReads, [media.url]);
      assert.equal(await f.balance(), 998);
    } finally { await f.cleanup(); }
  });

  await t.test("hide and success cannot overwrite each other's parameters", async () => {
    const f = await fixture();
    try {
      const generation = await f.reserve();
      await Promise.all([
        f.mutations.hideCreations(f.account, { id: generation.id }),
        f.lifecycle.completeGeneration({ account: f.account, id: generation.id,
          output: { media: { url: "https://example.test/success.png" }, type: "image", role: "output", position: 0 } }),
      ]);
      const saved = await db.generation.findUniqueOrThrow({ where: { id: generation.id } });
      assert.equal(saved.status, "success");
      assert.equal((saved.parameters as { hiddenFromRecent: boolean }).hiddenFromRecent, true);
      assert.equal(typeof (saved.parameters as { processingDurationMs: number }).processingDurationMs, "number");
    } finally { await f.cleanup(); }
  });

  await t.test("referencing before deletion pins media; deletion first rejects later reference without charge", async () => {
    const f = await fixture();
    try {
      const first = await f.complete();
      await f.lifecycle.reserveGeneration({ account: f.account, type: "video", prompt: "Reference", modelOptionId: "fixture", creditsCost: 2,
        parameters: {}, inputs: [{ media: first.media, role: "input", type: "image", position: 0 }] });
      await f.mutations.deleteCreationOutputs(f.account, { id: first.reserved.id, url: first.media.url });
      assert.equal(f.deleted.length, 0);
      assert.ok(await db.mediaAsset.findUnique({ where: { userId_url: { userId: f.account.id, url: first.media.url } } }));
      const second = await f.complete();
      await f.mutations.deleteCreationOutputs(f.account, { id: second.reserved.id, url: second.media.url });
      const balance = await f.balance();
      await assert.rejects(f.lifecycle.reserveGeneration({ account: f.account, type: "video", prompt: "Too late", modelOptionId: "fixture", creditsCost: 2,
        parameters: {}, inputs: [{ media: second.media, role: "input", type: "image", position: 0 }] }));
      assert.deepEqual(f.deleted, [second.media.url]);
      assert.equal(await f.balance(), balance);
    } finally { await f.cleanup(); }
  });

  await t.test("failed Blob deletion is durable and can be retried with the same output target", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      const { reserved, media } = await f.complete();
      f.setDelete(async () => { throw new Error("Blob offline"); });
      await assert.rejects(f.mutations.deleteCreationOutputs(f.account, { id: reserved.id, url: media.url }), /retry deletion/);
      const saved = await db.generation.findUniqueOrThrow({ where: { id: reserved.id } });
      assert.deepEqual((saved.parameters as { pendingMediaCleanup: string[] }).pendingMediaCleanup, [media.url]);
      f.setDelete(async () => {});
      await f.mutations.deleteCreationOutputs(f.account, { id: reserved.id, url: media.url });
      assert.deepEqual(f.deleted, [media.url]);
      const retried = await db.generation.findUniqueOrThrow({ where: { id: reserved.id } });
      assert.deepEqual((retried.parameters as { pendingMediaCleanup: string[] }).pendingMediaCleanup, []);
    } finally { await f.cleanup(); }
  });

  await t.test("history access recovers timed-out reservations without a provider task ID", async () => {
    const f = await fixture();
    try {
      const generation = await f.reserve();
      await db.generation.update({ where: { id: generation.id }, data: { createdAt: new Date(Date.now() - 6 * 60_000) } });
      const response = await f.creations.GET(new Request("http://localhost/api/creations"));
      const body = await response.json();
      assert.equal(body.creations[0].status, "failed");
      assert.equal(await f.balance(), 1000);
    } finally { await f.cleanup(); }
  });

  await t.test("account deletion blocks active reservations before touching Blob", async () => {
    const f = await fixture();
    try {
      await f.reserve();
      const response = await f.deletion.DELETE(request("/api/account", { confirmation: "DELETE" }, "DELETE"));
      assert.equal(response.status, 409);
      assert.equal(f.deleted.length, 0);
      assert.ok(await db.user.findUnique({ where: { id: f.account.id } }));
    } finally { await f.cleanup(); }
  });

  await t.test("account deletion waits for an unfinished storage attempt even after refund", async () => {
    const f = await fixture();
    try {
      const reserved = await f.reserve("video");
      const claim = await f.lifecycle.claimGenerationOutput(f.account, reserved.id);
      const path = `generations/${f.account.id}/video/unfinished.mp4`;
      await f.lifecycle.recordGenerationOutputPath(f.account, reserved.id, claim.attemptId!, path);
      await f.lifecycle.failGeneration({ account: f.account, id: reserved.id, error: { errorCode: "timeout" } });
      const response = await f.deletion.DELETE(new Request("http://localhost/api/account", {
        method: "DELETE", body: JSON.stringify({ confirmation: "DELETE" }),
      }));
      assert.equal(response.status, 409);
      assert.deepEqual(f.deleted, []);
      assert.ok(await db.user.findUnique({ where: { id: f.account.id } }));
    } finally { await f.cleanup(); }
  });

  await t.test("a reservation cannot start while account media is being irreversibly deleted", { timeout: 5000 }, async () => {
    const f = await fixture();
    let release!: () => void;
    try {
      await db.user.update({ where: { id: f.account.id }, data: { customAvatarUrl: "https://fixture.public.blob.vercel-storage.com/avatar.png" } });
      let reached!: () => void;
      const deleting = new Promise<void>((resolve) => { reached = resolve; });
      const gate = new Promise<void>((resolve) => { release = resolve; });
      f.setDelete(async () => { reached(); await gate; });
      const deletion = f.deletion.DELETE(request("/api/account", { confirmation: "DELETE" }, "DELETE"));
      await deleting;
      const reservation = f.reserve();
      const rejected = assert.rejects(reservation, (error: unknown) => (error as { errorCode: string }).errorCode === "auth_required");
      release();
      assert.equal((await deletion).status, 200);
      await rejected;
      assert.equal(await db.user.findUnique({ where: { id: f.account.id } }), null);
    } finally { release?.(); await f.cleanup(); }
  });

  await t.test("account deletion cancels past_due and remotely discovered unpaid subscriptions", async () => {
    const f = await fixture();
    try {
      const customer = `cus_${f.account.id}`;
      await db.user.update({ where: { id: f.account.id }, data: { stripeCustomerId: customer } });
      for (const status of ["past_due", "unpaid"] as const) {
        const sub = { id: `sub_${status}_${f.account.id}`, customer, status,
          created: Math.ceil(f.user.createdAt.getTime() / 1000),
          metadata: { userId: f.account.id, accountCreatedAt: f.account.accountCreatedAt },
        } as unknown as Stripe.Subscription;
        f.stripeSubs.set(sub.id, sub);
        if (status === "past_due") await db.subscription.create({ data: {
          userId: f.account.id, stripeSubscriptionId: sub.id, stripePriceId: "price_fixture", planType: "starter", billingCycle: "monthly",
          status, currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000),
        } });
      }
      const response = await f.deletion.DELETE(request("/api/account", { confirmation: "DELETE" }, "DELETE"));
      assert.equal(response.status, 200);
      assert.equal(f.cancellations.length, 2);
    } finally { await f.cleanup(); }
  });

  await t.test("Stripe resource_missing does not authorize account deletion", async (t) => {
    const f = await fixture();
    try {
      t.mock.method(console, "error", () => {});
      await db.subscription.create({ data: { userId: f.account.id, stripeSubscriptionId: `missing_${f.account.id}`,
        stripePriceId: "price_fixture", planType: "starter", billingCycle: "monthly", status: "past_due",
        currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) } });
      const response = await f.deletion.DELETE(request("/api/account", { confirmation: "DELETE" }, "DELETE"));
      assert.equal(response.status, 502);
      assert.ok(await db.user.findUnique({ where: { id: f.account.id } }));
    } finally { await f.cleanup(); }
  });
});
