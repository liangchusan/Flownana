import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCreationDownloadPath,
  buildCreationDownloadFilename,
} from "../lib/creation-download.ts";
import { createSourceLoader } from "./helpers/load-source.ts";

test("creation download paths use the API creationId parameter", () => {
  const path = buildCreationDownloadPath(
    "task-123",
    "https://blob.example/video.mp4?token=abc"
  );
  const parsed = new URL(path, "https://www.flownana.com");

  assert.equal(parsed.pathname, "/api/creations/download");
  assert.equal(parsed.searchParams.get("creationId"), "task-123");
  assert.equal(
    parsed.searchParams.get("url"),
    "https://blob.example/video.mp4?token=abc"
  );
  assert.equal(parsed.searchParams.has("id"), false);
});

test("download names use stable generation dates, output order and the actual media format", () => {
  const options = { type: "image", createdAt: new Date("2026-10-10T14:30:25Z"), outputIndex: 0, contentType: "image/png" };
  assert.equal(buildCreationDownloadFilename(options), "Flownana-Image-2026-10-10_143025-01.png");
  assert.equal(buildCreationDownloadFilename({ ...options, outputIndex: 3, contentType: "image/jpeg; charset=binary" }), "Flownana-Image-2026-10-10_143025-04.jpg");
  assert.equal(buildCreationDownloadFilename({ ...options, type: "video", contentType: "video/quicktime" }), "Flownana-Video-2026-10-10_143025-01.mov");
  assert.equal(buildCreationDownloadFilename({ ...options, type: "music", contentType: "audio/mp4" }), "Flownana-Audio-2026-10-10_143025-01.m4a");
});

test("Blob downloads keep ownership checks and stream with a readable attachment name", async () => {
  let userId: string | null = "owner";
  let found = true;
  let fetches = 0;
  const url = "https://store.public.blob.vercel-storage.com/random-id.bin";
  const load = createSourceLoader({
    "next-auth": { getServerSession: async () => userId ? { user: { id: userId } } : null },
    "@/lib/auth-options": { authOptions: {} },
    "@/lib/prisma": { prisma: { generation: { findFirst: async (query: any) => {
      assert.equal(query.where.userId, "owner");
      assert.equal(query.where.urls.has, url);
      return found ? { id: "creation", type: "video", createdAt: new Date("2026-10-10T14:30:25Z"), urls: [url] } : null;
    } } } },
    "@/lib/safe-remote-media": { safeRemoteMediaFetch: async (options: any) => {
      fetches++;
      assert.equal(options.url, url);
      assert.equal(options.kind, "video");
      return { contentType: "video/mp4", body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); controller.close(); } }) };
    } },
  });
  const { GET } = load<any>("app/api/creations/download/route.ts");
  const request = () => new Request(`https://www.flownana.com${buildCreationDownloadPath("creation", url)}`);
  const response = await GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Disposition"), 'attachment; filename="Flownana-Video-2026-10-10_143025-01.mp4"');
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
  found = false;
  assert.equal((await GET(request())).status, 404);
  userId = null;
  assert.equal((await GET(request())).status, 401);
  assert.equal(fetches, 1);
});
