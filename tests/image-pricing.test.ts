import assert from "node:assert/strict";
import test from "node:test";
import {
  IMAGE_MODEL_OPTION_MAP,
  IMAGE_RESOLUTION_CREDITS,
  getImageGenerationCredits,
} from "../lib/generation-pricing.ts";

test("default image generation credits match GPT Image 2 platform pricing", () => {
  assert.deepEqual(IMAGE_RESOLUTION_CREDITS, {
    "1K": 2,
    "2K": 3,
    "4K": 5,
  });
});

test("image generation credits are priced by model", () => {
  assert.deepEqual(IMAGE_MODEL_OPTION_MAP["gpt-image-2"].credits, {
    "1K": 2,
    "2K": 3,
    "4K": 5,
  });
  assert.deepEqual(IMAGE_MODEL_OPTION_MAP["nano-banana-2"].credits, {
    "1K": 2,
    "2K": 4,
    "4K": 5,
  });
  assert.deepEqual(IMAGE_MODEL_OPTION_MAP["qwen-image-3-pro"].credits, {
    "1K": 2,
    "2K": 4,
  });
  assert.deepEqual(IMAGE_MODEL_OPTION_MAP["qwen-image-3-pro"].resolutions, [
    "1K",
    "2K",
  ]);
  assert.equal(
    IMAGE_MODEL_OPTION_MAP["qwen-image-3-pro"].textToImageModel,
    "qwen3/pro-text-to-image"
  );
  assert.equal(
    IMAGE_MODEL_OPTION_MAP["qwen-image-3-pro"].imageToImageModel,
    "qwen3/pro-image-to-image"
  );
});

test("unknown image model falls back to GPT Image 2 pricing", () => {
  assert.equal(getImageGenerationCredits("unknown-model", "2K"), 3);
});

test("Seedream image pricing includes additional inputs before rounding each output", () => {
  assert.deepEqual(Array.from({ length: 10 }, (_, i) => getImageGenerationCredits("seedream-5-pro", "1K", i + 1)), [2, 2, 2, 3, 3, 3, 3, 3, 3, 3]);
  assert.deepEqual(Array.from({ length: 10 }, (_, i) => getImageGenerationCredits("seedream-5-pro", "2K", i + 1)), [4, 4, 5, 5, 5, 5, 5, 5, 5, 6]);
  for (const count of [-1, 1.5, 11]) assert.equal(getImageGenerationCredits("seedream-5-pro", "1K", count), undefined);
  assert.equal(getImageGenerationCredits("seedream-5-pro", "4K", 1), undefined);
  assert.equal(getImageGenerationCredits("seedream-5-pro", "2K", 10)! * 4, 24);
});
