import assert from "node:assert/strict";
import test from "node:test";
import {
  getAttachmentLimit,
  getImageInputCapabilities,
  getVideoInputCapabilities,
  hasTooManyImageInputs,
} from "../lib/generation-input-capabilities.ts";

test("image input limits follow the active model", () => {
  assert.equal(getImageInputCapabilities("gpt-image-2").maxImages, 1);
  assert.equal(getImageInputCapabilities("nano-banana-2").maxImages, 1);
  assert.equal(getImageInputCapabilities("qwen-image-3-pro").maxImages, 3);
  assert.equal(
    getImageInputCapabilities("qwen-image-3-pro").maxImageBytes,
    10 * 1024 * 1024
  );
});

test("video input limits expose MiniMax first and last frames", () => {
  const minimax = getVideoInputCapabilities("MiniMax H3");
  assert.equal(minimax.maxImages, 2);
  assert.deepEqual(minimax.imageRoles, ["First frame", "Last frame"]);
  assert.equal(minimax.acceptsVideo, false);
  assert.equal(minimax.acceptsAudio, false);
});

test("Seedance Mini accepts the documented multimodal reference counts", () => {
  const seedance = getVideoInputCapabilities("Seedance 2.0 Mini");
  assert.equal(seedance.maxImages, 9);
  assert.equal(seedance.maxVideos, 3);
  assert.equal(seedance.maxAudios, 3);
  assert.equal(getAttachmentLimit(seedance, "video"), 3);
  assert.equal(getAttachmentLimit(seedance, "audio"), 3);
});

test("Grok requires one image while other active video models keep it optional", () => {
  assert.equal(
    getVideoInputCapabilities("Grok Imagine Video 1.5").imageRequired,
    true
  );
  assert.equal(
    getVideoInputCapabilities("HappyHorse 1.1").imageRequired,
    false
  );
});

test("attachment compatibility is derived from the model capability", () => {
  const capabilities = getImageInputCapabilities("qwen-image-3-pro");
  assert.equal(getAttachmentLimit(capabilities, "image"), 3);
  assert.equal(getAttachmentLimit(capabilities, "video"), 0);
  assert.equal(getAttachmentLimit(capabilities, "audio"), 0);
  assert.equal(hasTooManyImageInputs(capabilities, 3), false);
  assert.equal(hasTooManyImageInputs(capabilities, 4), true);
});
