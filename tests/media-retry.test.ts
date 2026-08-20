import assert from "node:assert/strict";
import test from "node:test";
import { addMediaRetryParam, isVercelBlobUrl } from "../lib/media-retry.ts";

test("recognizes only public Vercel Blob media URLs", () => {
  assert.equal(
    isVercelBlobUrl("https://store.public.blob.vercel-storage.com/generations/image.png"),
    true
  );
  assert.equal(isVercelBlobUrl("https://example.com/image.png"), false);
  assert.equal(isVercelBlobUrl("not-a-url"), false);
});

test("adds a cache-busting retry value without dropping existing query params", () => {
  const retried = addMediaRetryParam(
    "https://store.public.blob.vercel-storage.com/image.png?download=1",
    123
  );
  const parsed = new URL(retried);

  assert.equal(parsed.searchParams.get("download"), "1");
  assert.equal(parsed.searchParams.get("flownana_retry"), "123");
});

test("returns malformed URLs unchanged", () => {
  assert.equal(addMediaRetryParam("not-a-url", 123), "not-a-url");
});
