import assert from "node:assert/strict";
import test from "node:test";
import { buildCreationDownloadPath } from "../lib/creation-download.ts";

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
