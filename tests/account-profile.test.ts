import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_GENERATION_STATUSES,
  getAvatarValidationError,
  isDeleteConfirmationValid,
  isOwnedBlobUrl,
  MAX_AVATAR_BYTES,
} from "../lib/account-profile.ts";

test("avatar validation accepts supported images up to 5 MB", () => {
  assert.equal(
    getAvatarValidationError({ type: "image/jpeg", size: MAX_AVATAR_BYTES }),
    null
  );
  assert.equal(
    getAvatarValidationError({ type: "image/png", size: 1024 }),
    null
  );
  assert.equal(
    getAvatarValidationError({ type: "image/webp", size: 1024 }),
    null
  );
});

test("avatar validation rejects unsupported, empty, and oversized files", () => {
  assert.match(
    getAvatarValidationError({ type: "image/gif", size: 1024 }) || "",
    /JPG, PNG, or WebP/
  );
  assert.match(
    getAvatarValidationError({ type: "image/png", size: 0 }) || "",
    /empty/
  );
  assert.match(
    getAvatarValidationError({ type: "image/png", size: MAX_AVATAR_BYTES + 1 }) || "",
    /5 MB/
  );
});

test("account deletion requires the exact confirmation and blocks active statuses", () => {
  assert.equal(isDeleteConfirmationValid("DELETE"), true);
  assert.equal(isDeleteConfirmationValid("delete"), false);
  assert.equal(isDeleteConfirmationValid(" DELETE "), false);
  assert.deepEqual(ACTIVE_GENERATION_STATUSES, [
    "pending",
    "generating",
    "processing",
  ]);
});

test("account deletion only treats public Vercel Blob URLs as owned media", () => {
  assert.equal(
    isOwnedBlobUrl("https://store.public.blob.vercel-storage.com/generations/user/a.png"),
    true
  );
  assert.equal(isOwnedBlobUrl("https://example.com/a.png"), false);
  assert.equal(isOwnedBlobUrl("not-a-url"), false);
  assert.equal(
    isOwnedBlobUrl("http://store.public.blob.vercel-storage.com/a.png"),
    false
  );
});
