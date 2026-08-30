import assert from "node:assert/strict";
import test from "node:test";
import {
  createPinnedLookup,
  isPublicNetworkAddress,
} from "../lib/safe-remote-media.ts";
import {
  getUploadIdFromBlobUrl,
  parseMediaUploadPayload,
  shouldDeleteOrphanedUpload,
} from "../lib/media-upload-policy.ts";
import { readFileSync } from "node:fs";

test("remote media rejects private, loopback, link-local, and mapped addresses", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ]) assert.equal(isPublicNetworkAddress(address), false, address);
  assert.equal(isPublicNetworkAddress("8.8.8.8"), true);
  assert.equal(isPublicNetworkAddress("2606:4700:4700::1111"), true);
});

test("remote media pins the validated address for single and all-address lookups", () => {
  const resolved = { address: "8.8.8.8", family: 4 };
  const pinnedLookup = createPinnedLookup(resolved);

  pinnedLookup("ignored.example", { all: false }, (error, address, family) => {
    assert.ifError(error);
    assert.equal(address, resolved.address);
    assert.equal(family, resolved.family);
  });

  pinnedLookup("ignored.example", { all: true }, (error, addresses) => {
    assert.ifError(error);
    assert.deepEqual(addresses, [resolved]);
  });
});

test("upload payload requires a bounded UUID reservation", () => {
  const uploadId = "123e4567-e89b-42d3-a456-426614174000";
  assert.deepEqual(
    parseMediaUploadPayload(JSON.stringify({ kind: "image", sizeBytes: 1234, uploadId })),
    { kind: "image", sizeBytes: 1234, uploadId }
  );
  assert.throws(() => parseMediaUploadPayload("image"));
  assert.throws(() => parseMediaUploadPayload(JSON.stringify({ kind: "video", sizeBytes: 60 * 1024 * 1024, uploadId })));
});

test("only the user-upload pathname shape yields a grant id", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(
    getUploadIdFromBlobUrl(`https://store.public.blob.vercel-storage.com/generation-inputs/image/${id}/a.png`),
    id
  );
  assert.equal(getUploadIdFromBlobUrl(`https://example.com/generation-inputs/image/${id}/a.png`), null);
  assert.equal(getUploadIdFromBlobUrl("https://store.public.blob.vercel-storage.com/generations/a.png"), null);
});

test("image data URLs cannot bypass authenticated upload reservations", () => {
  const source = readFileSync(new URL("../lib/media-assets.ts", import.meta.url), "utf8");
  assert.match(source, /startsWith\("data:"\)[\s\S]*authenticated upload flow/);
});

test("stale uploads without a completed grant are cleaned while active uploads remain", () => {
  const now = new Date("2026-08-30T00:00:00Z");
  const old = new Date("2026-08-28T00:00:00Z");
  assert.equal(shouldDeleteOrphanedUpload({ uploadedAt: old, now, grant: null }), true);
  assert.equal(
    shouldDeleteOrphanedUpload({
      uploadedAt: old,
      now,
      grant: { completedAt: null, expiresAt: new Date("2026-08-29T00:00:00Z") },
    }),
    true
  );
  assert.equal(
    shouldDeleteOrphanedUpload({
      uploadedAt: old,
      now,
      grant: { completedAt: old, expiresAt: old },
    }),
    false
  );
});

test("upload completion and lazy registration serialize one-time grant claims", () => {
  const uploadRoute = readFileSync(
    new URL("../app/api/creations/upload/route.ts", import.meta.url),
    "utf8"
  );
  const mediaAssets = readFileSync(new URL("../lib/media-assets.ts", import.meta.url), "utf8");
  assert.match(uploadRoute, /MediaUploadGrant[\s\S]*FOR UPDATE/);
  assert.match(mediaAssets, /MediaUploadGrant[\s\S]*FOR UPDATE/);
  assert.match(mediaAssets, /expiresAt\s*<=\s*new Date\(\)/);
});
