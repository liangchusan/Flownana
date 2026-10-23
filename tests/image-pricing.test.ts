import assert from "node:assert/strict";
import test from "node:test";
import { IMAGE_MODEL_OPTION_MAP, IMAGE_MODEL_OPTIONS, IMAGE_RESOLUTION_CREDITS, DEFAULT_IMAGE_MODEL_ID, getImageGenerationCredits } from "../lib/generation-pricing.ts";

test("new direct-image default and prices match Nano Banana 2.1", () => {
  assert.equal(DEFAULT_IMAGE_MODEL_ID, "nano-banana-2-1");
  assert.deepEqual(IMAGE_RESOLUTION_CREDITS, { "1K": 1, "2K": 2, "4K": 3 });
  assert.deepEqual(IMAGE_MODEL_OPTIONS.map(model => model.label), ["Nano Banana 2.1", "Grok Imagine Image 2.0", "GPT Image 2.5 Flare", "GPT Image 2.5 Sunburst"]);
  for (const [resolution, cost] of Object.entries(IMAGE_RESOLUTION_CREDITS)) {
    assert.equal(getImageGenerationCredits(DEFAULT_IMAGE_MODEL_ID, resolution as never, 10), cost);
    assert.equal(cost * 4, [4, 8, 12][["1K", "2K", "4K"].indexOf(resolution)]);
  }
});
test("retired and unknown image models retain historical metadata but cannot be quoted", () => {
  for (const id of ["gpt-image-2", "nano-banana-2", "qwen-image-3-pro", "seedream-5-pro"]) {
    assert.ok(IMAGE_MODEL_OPTION_MAP[id as keyof typeof IMAGE_MODEL_OPTION_MAP]);
    for (const resolution of ["1K", "2K", "4K"] as const) assert.equal(getImageGenerationCredits(id, resolution, 1), undefined);
  }
  assert.equal(getImageGenerationCredits("unknown-model", "2K"), undefined);
  assert.equal(getImageGenerationCredits(undefined, "1K"), undefined);
});
test("active image prices use official costs before per-output rounding", () => {
  for (const id of ["gpt-image-2-5-flare", "gpt-image-2-5-sunburst"]) {
    for (const [index, resolution] of (["1K", "2K", "4K"] as const).entries()) {
      assert.equal(getImageGenerationCredits(id, resolution, 16), Math.round([6, 10, 16][index] * 0.3));
    }
  }
  for (const count of [-1, 1.5]) assert.equal(getImageGenerationCredits(DEFAULT_IMAGE_MODEL_ID, "1K", count), undefined);
  for (let count = 0; count <= 5; count++) assert.equal(getImageGenerationCredits("grok-imagine-image-2-0", "1K", count), 1);
});
