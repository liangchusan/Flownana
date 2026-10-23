import assert from "node:assert/strict";
import test from "node:test";
import { KIE_VIDEO_CREDIT_MULTIPLIER, VIDEO_MODEL_OPTION_MAP, VIDEO_MODEL_OPTIONS, getVideoModelName, getVideoGenerationCredits, getDisplayAspectRatios, getDisplayResolutions, getDisplaySoundOptions } from "../lib/generation-pricing.ts";

test("only five officially named video models can be selected", () => {
  assert.deepEqual([...new Set(VIDEO_MODEL_OPTIONS.map(getVideoModelName))], ["Seedance 2.0 Mini", "Gemini Omni 1.1 Flash", "Wan 3.0 Video", "MiniMax H3 (Hailuo-03)", "Grok Imagine Video 1.5"]);
  assert.equal(KIE_VIDEO_CREDIT_MULTIPLIER, 0.2);
  assert.equal(VIDEO_MODEL_OPTIONS[0].id, "seedance2mini_480_4");
  for (const option of VIDEO_MODEL_OPTIONS) assert.equal(option.provider, "kie");
});
test("Grok 480P one second keeps the approved minimum one-credit price", () => {
  assert.equal(VIDEO_MODEL_OPTION_MAP.grok15_480_1.credits, 1);
  assert.equal(getVideoGenerationCredits(VIDEO_MODEL_OPTION_MAP.grok15_480_1), 1);
});
test("all no-video rates match the verified KIE price table", () => {
  for (const option of VIDEO_MODEL_OPTIONS) {
    const rates: Record<string, Record<string, number>> = { seedance: { "480P": 3.8, "720P": 8.2 }, wan: { "480P": 8, "720P": 16, "1080P": 32 }, minimax: { "720P": 8 }, grok: { "480P": 2.4, "720P": 4.5 } };
    if (option.family === "gemini") {
      assert.equal(option.providerModel, "google/gemini-omni-flash-1-1");
      const position = [4, 6, 8, 10].indexOf(option.duration);
      const costs = option.resolution === "4K" ? [147, 168, 189, 210] : [63, 84, 105, 126];
      assert.equal(option.credits, Math.round(costs[position] * 0.2));
    } else {
      const rounded = Math.round(rates[option.family][option.resolution] * option.duration * 0.2);
      assert.equal(option.credits, option.family === "grok" ? Math.max(1, rounded) : rounded);
    }
  }
});
test("Seedance reference-video price includes actual input seconds at its separate rate", () => {
  const inputs = [{ kind: "video", durationSeconds: 4.5 }, { kind: "video", durationSeconds: 2 }];
  assert.equal(getVideoGenerationCredits(VIDEO_MODEL_OPTION_MAP.seedance2mini_720_5, inputs), 12);
  assert.equal(getVideoGenerationCredits(VIDEO_MODEL_OPTION_MAP.seedance2mini_480_5, inputs), 6);
  assert.equal(getVideoGenerationCredits(VIDEO_MODEL_OPTION_MAP.seedance2mini_720_5), 8);
  assert.equal(getVideoGenerationCredits(VIDEO_MODEL_OPTION_MAP.seedance2mini_720_5, [{ kind: "video" }]), undefined);
  assert.equal(getVideoGenerationCredits(VIDEO_MODEL_OPTION_MAP.seedance2mini_720_5, [{ kind: "video", durationSeconds: NaN }]), undefined);
});
test("Wan video input contributes billable time and cannot exceed the upstream 30-second sum", () => {
  assert.equal(getVideoGenerationCredits(VIDEO_MODEL_OPTION_MAP.wan30_720_10, [{ kind: "video", durationSeconds: 5 }]), 48);
  assert.equal(getVideoGenerationCredits(VIDEO_MODEL_OPTION_MAP.wan30_1080_15, [{ kind: "video", durationSeconds: 15 }]), 192);
  assert.equal(getVideoGenerationCredits(VIDEO_MODEL_OPTION_MAP.wan30_1080_16, [{ kind: "video", durationSeconds: 15 }]), undefined);
});
test("retired video IDs retain metadata solely for paid-task polling", () => {
  assert.equal(VIDEO_MODEL_OPTION_MAP.happyhorse11_720_3.credits, 13);
  assert.equal(VIDEO_MODEL_OPTION_MAP.geminiomni_720_4.credits, 18);
  assert.equal(VIDEO_MODEL_OPTION_MAP.minimaxh3_2k_4.credits, 23);
  for (const id of ["geminiomni_720_4", "happyhorse11_720_3", "minimaxh3_2k_4"]) {
    assert.ok(VIDEO_MODEL_OPTION_MAP[id]);
    assert.equal(VIDEO_MODEL_OPTIONS.some(option => option.id === id), false);
    assert.equal(getVideoGenerationCredits(VIDEO_MODEL_OPTION_MAP[id]), undefined);
  }
});
test("model parameter displays remain genuine whitelist intersections", () => {
  const options = (family: string) => VIDEO_MODEL_OPTIONS.filter(option => option.family === family);
  assert.deepEqual(getDisplayResolutions(options("grok")), ["480P", "720P"]);
  assert.deepEqual(getDisplayResolutions(options("minimax")), ["720P"]);
  assert.deepEqual(getDisplayResolutions(options("gemini")), ["720P", "1080P", "4K"]);
  assert.deepEqual(getDisplayResolutions(options("wan")), ["480P", "720P", "1080P"]);
  assert.deepEqual(getDisplayAspectRatios(options("grok")), ["Auto"]);
  assert.deepEqual(getDisplaySoundOptions(options("grok")), ["On", "Off"]);
  assert.deepEqual(getDisplaySoundOptions(options("gemini")), ["On"]);
});
