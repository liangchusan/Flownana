import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";

const load = createSourceLoader({});
const { getVideoPollingTarget } = load<typeof import("../lib/video-polling-target")>("lib/video-polling-target.ts");
const { VIDEO_MODEL_OPTION_MAP, LEGACY_VIDEO_MODEL_OPTIONS, VIDEO_MODEL_OPTIONS } = load<typeof import("../lib/generation-pricing")>("lib/generation-pricing.ts");

test("historical video providers remain pollable without reactivating retired generation options", () => {
  for (const [id, family] of [
    ["veo31_lite_8", "veo"], ["veo31_fast_8", "veo"], ["veo31_quality_8", "veo"],
    ["kling30_720_5", "kling"], ["happyhorse10_720_5", "happyhorse"],
    ["seedance20_720_5", "seedance"], ["seedance20fast_720_5", "seedance"],
  ]) {
    assert.deepEqual(getVideoPollingTarget(id, null), { provider: "kie", family });
    assert.equal(Object.hasOwn(VIDEO_MODEL_OPTION_MAP, id), false);
  }
  assert.equal(getVideoPollingTarget(null, null), null);
  assert.equal(getVideoPollingTarget("constructor", {}), null);
  assert.equal(getVideoPollingTarget("unknown", {}), null);
});

test("Seedance Mini preserves both legacy Volcengine and current KIE tasks", () => {
  assert.deepEqual(getVideoPollingTarget("seedance2mini_480_5", null), { provider: "volcengine", family: "seedance" });
  assert.deepEqual(getVideoPollingTarget("seedance2mini_480_5", { provider: "kie" }), { provider: "kie", family: "seedance" });
  assert.deepEqual(getVideoPollingTarget("geminiomni_720_4", { provider: "volcengine" }), { provider: "kie", family: "gemini" });
});

test("every newly retired Gemini and HappyHorse option keeps its original polling family", () => {
  const retired = LEGACY_VIDEO_MODEL_OPTIONS.filter(option => option.family === "gemini" || option.family === "happyhorse");
  assert.equal(retired.length, 38);
  for (const option of retired) {
    assert.equal(VIDEO_MODEL_OPTIONS.some(active => active.id === option.id), false, option.id);
    assert.deepEqual(getVideoPollingTarget(option.id, { provider: "kie" }), { provider: "kie", family: option.family });
    assert.equal(option.providerModel, option.family === "gemini" ? "gemini-omni-video" : "happyhorse-1-1/text-to-video");
  }
});
