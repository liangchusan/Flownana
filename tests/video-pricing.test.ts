import assert from "node:assert/strict";
import test from "node:test";
import {
  VIDEO_MODEL_OPTION_MAP,
  VIDEO_MODEL_OPTIONS,
  getDisplayAspectRatios,
  getDisplayResolutions,
  getDisplaySoundOptions,
} from "../lib/generation-pricing.ts";

test("new video model platform credits follow KIE API credits times 0.3", () => {
  assert.equal(VIDEO_MODEL_OPTION_MAP.seedance20fast_720_4.credits, 40);
  assert.equal(VIDEO_MODEL_OPTION_MAP.minimaxh3_720_4.credits, 22);
  assert.equal(VIDEO_MODEL_OPTION_MAP.minimaxh3_2k_4.credits, 35);
  assert.equal(VIDEO_MODEL_OPTION_MAP.minimaxh3_2k_15.credits, 131);
  assert.equal(VIDEO_MODEL_OPTION_MAP.grok15_720_8.credits, 60);
  assert.equal(VIDEO_MODEL_OPTION_MAP.happyhorse11_1080_15.credits, 153);
});

test("new video model options use their KIE provider models", () => {
  assert.equal(
    VIDEO_MODEL_OPTION_MAP.seedance20fast_480_4.providerModel,
    "bytedance/seedance-2-fast"
  );
  assert.equal(
    VIDEO_MODEL_OPTION_MAP.minimaxh3_720_4.providerModel,
    "minimax-h3/text-to-video"
  );
  assert.equal(
    VIDEO_MODEL_OPTION_MAP.minimaxh3_720_4.imageToVideoProviderModel,
    "minimax-h3/image-to-video"
  );
  assert.equal(
    VIDEO_MODEL_OPTION_MAP.grok15_480_1.providerModel,
    "grok-imagine-video-1-5-preview"
  );
  assert.equal(VIDEO_MODEL_OPTION_MAP.grok15_480_1.requiresImageInput, true);
  assert.equal(
    VIDEO_MODEL_OPTION_MAP.happyhorse11_720_3.imageToVideoProviderModel,
    "happyhorse-1-1/image-to-video"
  );
});

test("retired video models are no longer exposed as generation options", () => {
  const providerModels = new Set(VIDEO_MODEL_OPTIONS.map((option) => option.providerModel));
  assert.equal(providerModels.has("veo3_lite"), false);
  assert.equal(providerModels.has("veo3_fast"), false);
  assert.equal(providerModels.has("veo3"), false);
  assert.equal(providerModels.has("kling-3.0/video"), false);
  assert.equal(providerModels.has("kling/v3-turbo-text-to-video"), false);
  assert.equal(providerModels.has("bytedance/seedance-2"), false);
  assert.equal(providerModels.has("bytedance/seedance-2-mini"), false);
  assert.equal(providerModels.has("happyhorse/text-to-video"), false);
});

test("video parameter display rules keep only canonical aspect ratios", () => {
  const happyHorseOptions = VIDEO_MODEL_OPTIONS.filter((option) =>
    option.providerModel.startsWith("happyhorse-1-1/")
  );
  assert.deepEqual(getDisplayAspectRatios(happyHorseOptions), [
    "Auto",
    "16:9",
    "9:16",
    "1:1",
    "4:3",
    "3:4",
  ]);
});

test("video parameter display rules keep only canonical resolutions", () => {
  const seedanceFastOptions = VIDEO_MODEL_OPTIONS.filter(
    (option) => option.providerModel === "bytedance/seedance-2-fast"
  );
  assert.deepEqual(getDisplayResolutions(seedanceFastOptions), ["480P", "720P"]);

  const grokOptions = VIDEO_MODEL_OPTIONS.filter(
    (option) => option.providerModel === "grok-imagine-video-1-5-preview"
  );
  assert.deepEqual(getDisplayResolutions(grokOptions), ["480P", "720P"]);

  const minimaxOptions = VIDEO_MODEL_OPTIONS.filter(
    (option) => option.providerModel === "minimax-h3/text-to-video"
  );
  assert.deepEqual(getDisplayResolutions(minimaxOptions), ["720P", "2K"]);
});

test("video parameter display rules expose sound only when model supports it", () => {
  const seedanceOptions = VIDEO_MODEL_OPTIONS.filter(
    (option) => option.providerModel === "bytedance/seedance-2-fast"
  );
  assert.deepEqual(getDisplaySoundOptions(seedanceOptions), ["Auto", "On", "Off"]);

  const happyHorseOptions = VIDEO_MODEL_OPTIONS.filter((option) =>
    option.providerModel.startsWith("happyhorse-1-1/")
  );
  assert.deepEqual(getDisplaySoundOptions(happyHorseOptions), []);
});
