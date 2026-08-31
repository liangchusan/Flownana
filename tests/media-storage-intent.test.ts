import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";

test("generated media records its unique pathname before the Blob write", async () => {
  const writes: string[] = [];
  const intents: string[] = [];
  process.env.BLOB_READ_WRITE_TOKEN = "isolated_fixture_not_a_token";
  const storage = createSourceLoader({
    "@/lib/safe-remote-media": { safeRemoteMediaFetch: async () => ({
      url: "https://example.test/output.png", contentType: "image/png", sizeBytes: 10, body: Buffer.alloc(10),
    }) },
    "@vercel/blob": { put: async (pathname: string, _body: unknown, options: { allowOverwrite: boolean }) => {
      assert.ok(intents.includes(pathname));
      assert.equal(options.allowOverwrite, false);
      writes.push(pathname);
      return { url: `https://fixture.public.blob.vercel-storage.com/${pathname}` };
    } },
  })<typeof import("../lib/media-storage")>("lib/media-storage.ts");
  const options = { sourceUrl: "https://example.test/output.png", userId: "fixture_user", taskId: "fixture_task", kind: "image" as const,
    beforeUpload: async (pathname: string) => { intents.push(pathname); } };
  const first = await storage.persistGeneratedMedia(options);
  const second = await storage.persistGeneratedMedia(options);
  assert.notEqual(first.pathname, second.pathname);
  assert.deepEqual(writes, intents);
});

test("failed pathname reservation never reaches the Blob write", async (t) => {
  let writes = 0;
  process.env.BLOB_READ_WRITE_TOKEN = "isolated_fixture_not_a_token";
  t.mock.method(console, "error", () => {});
  const storage = createSourceLoader({
    "@/lib/safe-remote-media": { safeRemoteMediaFetch: async () => ({
      url: "https://example.test/output.png", contentType: "image/png", sizeBytes: 10, body: Buffer.alloc(10),
    }) },
    "@vercel/blob": { put: async () => { writes++; } },
  })<typeof import("../lib/media-storage")>("lib/media-storage.ts");
  await assert.rejects(storage.persistGeneratedMedia({ sourceUrl: "https://example.test/output.png", userId: "fixture_user",
    taskId: "fixture_task", kind: "image", beforeUpload: async () => { throw new Error("DB offline"); },
  }));
  assert.equal(writes, 0);
});
