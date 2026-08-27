import assert from "node:assert/strict";
import test from "node:test";
import {
  KIE_VIDEO_CREDIT_MULTIPLIER,
  VIDEO_MODEL_OPTION_MAP,
  VIDEO_MODEL_OPTIONS,
  getDisplayAspectRatios,
  getDisplayResolutions,
  getDisplaySoundOptions,
} from "../lib/generation-pricing.ts";

test("all KIE video model platform credits follow API credits times 0.2", () => {
  assert.equal(KIE_VIDEO_CREDIT_MULTIPLIER, 0.2);
  assert.equal(VIDEO_MODEL_OPTION_MAP.minimaxh3_720_4.credits, 14);
  assert.equal(VIDEO_MODEL_OPTION_MAP.minimaxh3_2k_4.credits, 23);
  assert.equal(VIDEO_MODEL_OPTION_MAP.minimaxh3_2k_15.credits, 87);
  assert.equal(VIDEO_MODEL_OPTION_MAP.grok15_720_8.credits, 40);
  assert.equal(VIDEO_MODEL_OPTION_MAP.happyhorse11_1080_15.credits, 102);
  assert.equal(VIDEO_MODEL_OPTION_MAP.geminiomni_720_4.credits, 18);
  assert.equal(VIDEO_MODEL_OPTION_MAP.geminiomni_4k_10.credits, 60);
  assert.equal(VIDEO_MODEL_OPTION_MAP.wan30_480_5.credits, 30);
  assert.equal(VIDEO_MODEL_OPTION_MAP.wan30_720_5.credits, 50);
  assert.equal(VIDEO_MODEL_OPTION_MAP.wan30_1080_5.credits, 90);
});

test("Seedance Mini uses KIE no-video pricing for every input mode with 480P first", () => {
  assert.equal(VIDEO_MODEL_OPTIONS[0].id, "seedance2mini_480_4");
  assert.equal(VIDEO_MODEL_OPTION_MAP.seedance2mini_480_4.credits, 8);
  assert.equal(VIDEO_MODEL_OPTION_MAP.seedance2mini_720_15.credits, 66);
  assert.equal(VIDEO_MODEL_OPTION_MAP.seedance2mini_480_4.provider, "kie");
  assert.equal(VIDEO_MODEL_OPTION_MAP.seedance2mini_480_4.providerModel, "bytedance/seedance-2-mini");
});

test("new video model options use their KIE provider models", () => {
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
  assert.equal(
    VIDEO_MODEL_OPTION_MAP.geminiomni_720_4.providerModel,
    "gemini-omni-video"
  );
  assert.equal(
    VIDEO_MODEL_OPTION_MAP.wan30_480_2.providerModel,
    "wan/3-0-video"
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
  assert.equal(providerModels.has("bytedance/seedance-2-mini"), true);
  assert.equal(providerModels.has("bytedance/seedance-2-fast"), false);
  assert.equal(providerModels.has("doubao-seedance-2-0-mini-260615"), false);
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
    "21:9",
  ]);
});

test("video parameter display rules keep only canonical resolutions", () => {
  const grokOptions = VIDEO_MODEL_OPTIONS.filter(
    (option) => option.providerModel === "grok-imagine-video-1-5-preview"
  );
  assert.deepEqual(getDisplayResolutions(grokOptions), ["480P", "720P"]);

  const minimaxOptions = VIDEO_MODEL_OPTIONS.filter(
    (option) => option.providerModel === "minimax-h3/text-to-video"
  );
  assert.deepEqual(getDisplayResolutions(minimaxOptions), ["720P", "2K"]);

  const geminiOptions = VIDEO_MODEL_OPTIONS.filter(
    (option) => option.providerModel === "gemini-omni-video"
  );
  assert.deepEqual(getDisplayResolutions(geminiOptions), ["720P", "1080P", "4K"]);

  const wanOptions = VIDEO_MODEL_OPTIONS.filter(
    (option) => option.providerModel === "wan/3-0-video"
  );
  assert.deepEqual(getDisplayResolutions(wanOptions), ["480P", "720P", "1080P"]);
});

test("video parameter display rules expose sound only when model supports it", () => {
  const happyHorseOptions = VIDEO_MODEL_OPTIONS.filter((option) =>
    option.providerModel.startsWith("happyhorse-1-1/")
  );
  assert.deepEqual(getDisplaySoundOptions(happyHorseOptions), []);
  assert.deepEqual(getDisplaySoundOptions(VIDEO_MODEL_OPTIONS), ["Auto", "On", "Off"]);
  const seedanceOptions = VIDEO_MODEL_OPTIONS.filter((option) => option.family === "seedance");
  assert.deepEqual(getDisplaySoundOptions(seedanceOptions), ["On", "Off"]);
  const wanOptions = VIDEO_MODEL_OPTIONS.filter((option) => option.family === "wan");
  assert.deepEqual(getDisplaySoundOptions(wanOptions), ["On", "Off"]);
});
