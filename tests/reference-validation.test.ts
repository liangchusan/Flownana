import assert from "node:assert/strict";
import test from "node:test";
import { referenceBatchIssue, referenceIssue, referenceMaxBytes, AGENT_INPUT_CAPABILITIES } from "../lib/reference-validation.ts";
import { getImageInputCapabilities, getVideoInputCapabilities } from "../lib/generation-input-capabilities.ts";
import { IMAGE_MODEL_OPTIONS, VIDEO_MODEL_OPTIONS, DEFAULT_VIDEO_RESOLUTIONS, getDisplayResolutions, getVideoModelName, videoFollowsInputRatio } from "../lib/generation-pricing.ts";
import { getImageAspectRatios, CREATION_ASPECT_RATIOS } from "../lib/image-model-capabilities.ts";
const image = { kind: "image" as const, contentType: "image/png", sizeBytes: 1024 };
const clip = (durationSeconds: number, kind: "video" | "audio" = "video") => ({ kind, durationSeconds, sizeBytes: 1024, contentType: kind === "video" ? "video/mp4" : "audio/mpeg" });

test("every image model accepts its reference limit and rejects limit + 1", () => {
  for (const model of IMAGE_MODEL_OPTIONS) {
    const caps = getImageInputCapabilities(model.id);
    assert.equal(referenceBatchIssue(caps, Array(caps.maxImages).fill(image), true), undefined);
    assert.match(referenceBatchIssue(caps, Array(caps.maxImages + 1).fill(image))!, /at most/);
    assert.equal(referenceIssue(caps, { ...image, sizeBytes: caps.maxImageBytes }), undefined);
    assert.match(referenceIssue(caps, { ...image, sizeBytes: caps.maxImageBytes + 1 })!, /Maximum/);
  }
});
test("input size, unknown metadata and actual formats are checked for both sources", () => {
  const caps = getVideoInputCapabilities("Seedance 2.0 Mini");
  assert.equal(referenceMaxBytes(caps, "image", true), 20 * 1024 ** 2);
  assert.equal(referenceMaxBytes(caps, "image", false), 30 * 1024 ** 2);
  assert.match(referenceIssue(caps, { ...image, sizeBytes: 0 })!, /Maximum/);
  assert.match(referenceIssue(caps, { kind: "image" }, { requireMetadata: true })!, /Check/);
  assert.match(referenceIssue(getImageInputCapabilities("seedream-5-pro"), { ...image, contentType: "image/gif" })!, /format/);
  assert.match(referenceIssue(caps, { ...clip(3), contentType: "video/webm" })!, /format/);
});
test("video/audio limits include exact bounds and separate aggregate duration budgets", () => {
  const caps = getVideoInputCapabilities("Seedance 2.0 Mini");
  for (const d of [2, 15]) assert.equal(referenceIssue(caps, clip(d), { requireMetadata: true }), undefined);
  for (const d of [1.99, 15.01, Infinity, NaN]) assert.ok(referenceIssue(caps, clip(d)));
  assert.equal(referenceBatchIssue(caps, [clip(8), clip(7), clip(15, "audio")], true), undefined);
  assert.match(referenceBatchIssue(caps, [clip(8), clip(7.01)], true)!, /Combined video/);
  assert.match(referenceBatchIssue(caps, [clip(8, "audio"), clip(8, "audio")], true)!, /Combined audio/);
  assert.match(referenceBatchIssue(getVideoInputCapabilities("Wan 3.0 Video"), [clip(3), clip(3)])!, /at most 1/);
});
test("Agent accepts platform references then applies selected model limits", () => {
  assert.equal(referenceBatchIssue(AGENT_INPUT_CAPABILITIES, [clip(25)], true), undefined);
  assert.ok(referenceBatchIssue(getVideoInputCapabilities("Seedance 2.0 Mini"), [clip(25)], true));
  assert.equal(referenceBatchIssue(AGENT_INPUT_CAPABILITIES, Array(22).fill(image), true), undefined);
  assert.match(referenceBatchIssue(AGENT_INPUT_CAPABILITIES, Array(23).fill(image))!, /22/);
});
test("all displayed ratios are ordered whitelist intersections; removed resolutions remain historical only", () => {
  for (const model of IMAGE_MODEL_OPTIONS) for (const resolution of ["1K", "2K", "4K"] as const) {
    const ratios = getImageAspectRatios(model.id, resolution, 1);
    assert.deepEqual(ratios, CREATION_ASPECT_RATIOS.filter(r => ratios.includes(r)));
    assert.ok(!ratios.includes("3:2"));
  }
  for (const name of new Set(VIDEO_MODEL_OPTIONS.map(getVideoModelName))) assert.ok(getDisplayResolutions(VIDEO_MODEL_OPTIONS.filter(o => getVideoModelName(o) === name)).every(r => DEFAULT_VIDEO_RESOLUTIONS.includes(r)));
  assert.equal(videoFollowsInputRatio("MiniMax H3", 1), true);
  assert.equal(videoFollowsInputRatio("HappyHorse 1.1", 0), false);
  assert.equal(videoFollowsInputRatio("Grok Imagine Video 1.5", 1), false);
});
