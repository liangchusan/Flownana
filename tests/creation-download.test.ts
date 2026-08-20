import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCreationDownloadPath,
  buildVercelBlobDownloadUrl,
} from "../lib/creation-download.ts";

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

test("public Vercel Blob downloads use the CDN attachment URL", () => {
  const downloadUrl = buildVercelBlobDownloadUrl(
    "https://store.public.blob.vercel-storage.com/generations/video.mp4?token=abc"
  );
  const parsed = new URL(downloadUrl || "");

  assert.equal(parsed.searchParams.get("token"), "abc");
  assert.equal(parsed.searchParams.get("download"), "1");
});

test("non-public Blob URLs stay on the authenticated proxy path", () => {
  assert.equal(
    buildVercelBlobDownloadUrl(
      "https://store.private.blob.vercel-storage.com/generations/video.mp4"
    ),
    null
  );
  assert.equal(
    buildVercelBlobDownloadUrl(
      "https://public.blob.vercel-storage.com.example.com/video.mp4"
    ),
    null
  );
});
