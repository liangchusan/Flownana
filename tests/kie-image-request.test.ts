import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";
import { getImageAspectRatios, isSupportedImageInputType, getImagePromptMinLength } from "../lib/image-model-capabilities.ts";
import { getImageInputCapabilities, isCompatibleImageMetadata } from "../lib/generation-input-capabilities.ts";

const load = createSourceLoader({});
const { buildKieImageRequest: build } = load<typeof import("../lib/kie-image-request")>("lib/kie-image-request.ts");
const { IMAGE_MODEL_OPTIONS, getImageGenerationCredits } = load<typeof import("../lib/generation-pricing")>("lib/generation-pricing.ts");

test("all image models send mode-specific provider fields and preserve ordered references", () => {
  const inputUrls = ["https://example.test/first.png", "https://example.test/second.png"];
  for (const model of IMAGE_MODEL_OPTIONS) {
    for (const editing of [false, true]) {
      const request = build({ modelId: model.id, prompt: "A landscape", aspectRatio: "16:9", resolution: "2K", ...(editing ? { inputUrls } : {}) });
      assert.equal(request.model, editing ? model.imageToImageModel : model.textToImageModel);
      const expected: Record<string, unknown> = { prompt: "A landscape" };
      if (model.id === "qwen-image-3-pro") Object.assign(expected, { image_size: "16:9", resolution: "2K", output_format: "png" });
      else if (model.id === "seedream-5-pro") Object.assign(expected, { aspect_ratio: "16:9", quality: "high", output_format: "png", nsfw_checker: true });
      else if (model.id === "grok-imagine-image-2-0") Object.assign(expected, { aspect_ratio: "16:9" });
      else Object.assign(expected, { aspect_ratio: "16:9", resolution: "2K", ...(model.id === "nano-banana-2" ? { output_format: "png" } : {}) });
      if (editing) expected[model.id.startsWith("gpt-image-") ? "input_urls" : model.id === "nano-banana-2" ? "image_input" : "image_urls"] = inputUrls;
      assert.deepEqual(request.input, expected, `${model.id}: ${editing}`);
    }
  }
  assert.equal(build({ modelId: "seedream-5-pro", prompt: "Landscape", aspectRatio: "1:1", resolution: "1K" }).input.quality, "basic");
});

test("Grok Auto requires an input and Seedream has no Auto or 4K option", () => {
  assert.ok(!getImageAspectRatios("grok-imagine-image-2-0", "1K", 0).includes("auto"));
  assert.ok(getImageAspectRatios("grok-imagine-image-2-0", "1K", 1).includes("auto"));
  assert.ok(!getImageAspectRatios("grok-imagine-image-2-0", "1K", 1).includes("4:3"));
  assert.ok(!getImageAspectRatios("seedream-5-pro", "1K", 0).includes("auto"));
  assert.equal(getImagePromptMinLength("seedream-5-pro"), 3);
  assert.equal(getImageInputCapabilities("grok-imagine-image-2-0").maxImages, 5);
  assert.equal(getImageInputCapabilities("seedream-5-pro").maxImages, 10);
});

test("Seedream text pricing uses verified resolution costs and rejects unsupported 4K", () => {
  assert.equal(getImageGenerationCredits("seedream-5-pro", "1K"), 2);
  assert.equal(getImageGenerationCredits("seedream-5-pro", "2K"), 4);
  assert.equal(getImageGenerationCredits("seedream-5-pro", "4K"), undefined);
});

test("model input formats and known metadata reject incompatible images", () => {
  assert.equal(isSupportedImageInputType("nano-banana-2", "image/heic"), false);
  assert.equal(isSupportedImageInputType("qwen-image-3-pro", "image/gif"), true);
  assert.equal(isSupportedImageInputType("grok-imagine-image-2-0", "image/gif"), false);
  assert.equal(isSupportedImageInputType("seedream-5-pro", "image/png; charset=binary"), true);
  assert.equal(isSupportedImageInputType("gpt-image-2", undefined), false);
  const capability = getImageInputCapabilities("seedream-5-pro");
  assert.equal(isCompatibleImageMetadata(capability, { contentType: "image/gif" }), false);
  assert.equal(isCompatibleImageMetadata(capability, { sizeBytes: 20 * 1024 * 1024 + 1 }), false);
});

test("Grok verified flat price applies to text and all supported reference counts", () => {
  for (let count = 0; count <= 5; count++) {
    assert.equal(getImageGenerationCredits("grok-imagine-image-2-0", "1K", count), 1);
  }
});

test("GPT 2.5 variants retain distinct IDs, prices and resolution-specific ratios", () => {
  for (const id of ["gpt-image-2-5-flare", "gpt-image-2-5-sunburst"] as const) {
    assert.equal(getImageInputCapabilities(id).maxImages, 16);
    for (const resolution of ["1K", "2K", "4K"] as const) {
      const ratios = getImageAspectRatios(id, resolution, 0);
      assert.ok(ratios.includes("auto") && ratios.includes("1:1"));
      for (const ratio of ["27:16", "16:27", "9:8", "8:9"]) assert.equal(ratios.includes(ratio), false);
      assert.equal(getImageGenerationCredits(id, resolution, 16), { "1K": 2, "2K": 3, "4K": 5 }[resolution]);
      const refs = Array.from({ length: 16 }, (_, i) => `https://example.test/${i}.png`);
      assert.deepEqual(build({ modelId: id, prompt: "Landscape", aspectRatio: "auto", resolution, inputUrls: refs }), {
        model: `${id}-image-to-image`, input: { prompt: "Landscape", aspect_ratio: "auto", resolution, input_urls: refs },
      });
    }
  }
});
