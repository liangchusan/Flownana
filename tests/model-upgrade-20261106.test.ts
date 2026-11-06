import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";
import { getVideoGenerationCredits, VIDEO_MODEL_OPTION_MAP, VIDEO_MODEL_OPTIONS } from "../lib/generation-pricing.ts";
import { getVideoInputCapabilities } from "../lib/generation-input-capabilities.ts";
import { referenceBatchIssue, referenceIssue } from "../lib/reference-validation.ts";
import { videoInputMode, videoReferenceLabels, videoReferencePromptIssue } from "../lib/video-model-capabilities.ts";

const load = createSourceLoader({});
const { buildQuote } = load<typeof import("../lib/agent/contract")>("lib/agent/contract.ts");
const { getKieMarketVideoTaskBody: videoBody } = load<typeof import("../lib/kie-video-request")>("lib/kie-video-request.ts");
const image = { kind: "image" as const, url: "https://media.test/image.png", contentType: "image/png", sizeBytes: 1024, role: "reference" as const };
const clip = (durationSeconds: number) => ({ kind: "video" as const, url: "https://media.test/video.mp4", contentType: "video/mp4", sizeBytes: 1024, durationSeconds, role: "reference" as const });
const proposal = { type: "video", model: "Kling 4.0", prompt: "Move the camera", summary: "A scene", exactText: [] };

test("Kling prices every output duration with and without actual video references", () => {
  for (const option of VIDEO_MODEL_OPTIONS.filter(o => o.family === "kling")) {
    const [noVideoRate, videoRate] = option.resolution === "720P" ? [28.5, 17] : [42.5, 25.5];
    assert.equal(getVideoGenerationCredits(option), Math.round(noVideoRate * option.duration * 0.2));
    for (const seconds of [2, 5, 10, 15.125, 30]) {
      assert.equal(getVideoGenerationCredits(option, [clip(seconds)]), Math.round(videoRate * (option.duration + Math.max(seconds, option.duration)) * 0.2));
    }
  }
  const option = VIDEO_MODEL_OPTION_MAP.kling40_720_10;
  assert.equal(getVideoGenerationCredits(option, [clip(5)]), 68);
  assert.equal(getVideoGenerationCredits(option, [clip(10)]), 68);
  assert.equal(getVideoGenerationCredits(option, [clip(15)]), 85);
  assert.equal(getVideoGenerationCredits(VIDEO_MODEL_OPTION_MAP.kling40_1080_10, [clip(15)]), 128);
  assert.equal(getVideoGenerationCredits(option, [clip(8), clip(7)]), 85);
  for (const refs of [[clip(1.99)], [clip(30.01)], [clip(16), clip(15)], Array(6).fill(clip(2)), [clip(NaN)], [{ kind: "video" }]]) {
    assert.equal(getVideoGenerationCredits(option, refs), undefined);
  }
});

test("Kling reference limits apply equally to uploaded and saved media", () => {
  const caps = getVideoInputCapabilities("Kling 4.0");
  for (const upload of [true, false]) {
    for (const kind of ["image", "video"] as const) {
      const ref = kind === "image" ? image : clip(2);
      assert.equal(referenceIssue(caps, { ...ref, sizeBytes: 10 * 1024 ** 2 }, { upload, requireMetadata: true }), undefined);
      assert.match(referenceIssue(caps, { ...ref, sizeBytes: 10 * 1024 ** 2 + 1 }, { upload })!, /Maximum/);
    }
  }
  assert.equal(referenceBatchIssue(caps, [...Array(10).fill(image), ...Array(5).fill(clip(6))], true), undefined);
  for (const refs of [Array(11).fill(image), Array(6).fill(clip(2)), [clip(1.99)], [clip(30.01)], [clip(15), clip(15.01)], [{ ...clip(3), kind: "audio" as const }], [{ ...clip(3), contentType: "video/quicktime" }]]) {
    assert.ok(referenceBatchIssue(caps, refs, true));
  }
  assert.equal(referenceIssue(caps, { ...image, width: 300, height: 750 }), undefined);
  assert.ok(referenceIssue(caps, { ...image, width: 299, height: 750 }));
  assert.ok(referenceIssue(caps, { ...image, width: 8001, height: 8001 }));
  assert.equal(referenceBatchIssue(caps, [clip(30)], true), undefined);
  assert.ok(referenceBatchIssue(getVideoInputCapabilities("Seedance 2.0 Mini"), [clip(30)], true));
});

test("Kling sends reference arrays, fixed source-audio policy and independent output ratio", () => {
  const option = VIDEO_MODEL_OPTION_MAP.kling40_1080_10;
  assert.deepEqual(videoBody({ option, prompt: "Use @image_1 and @video_1", aspectRatio: "9:16", inputs: [image, clip(5)], generateAudio: true }), {
    model: "kling-4.0/reference-to-video", input: { prompt: "Use @image_1 and @video_1", duration: 10, resolution: "1080p", aspect_ratio: "9:16", image_urls: [image.url], video_urls: [clip(5).url], keep_original_sound: false },
  });
  for (const refs of [[], [image], [image, image]]) {
    const body = videoBody({ option, prompt: "Move camera", aspectRatio: "Auto", inputs: refs });
    for (const key of ["aspect_ratio", "first_frame_url", "last_frame_url", "keep_original_sound", "elements", "voices", "generate_audio"]) assert.equal(key in body.input, false);
    assert.equal(videoInputMode(option, refs), refs.length ? "Image reference to video" : "Text to video");
  }
});

test("Kling reference tags match the ordered provider arrays and reject undeclared mentions", () => {
  const refs = [clip(5), image, image, clip(3)];
  assert.deepEqual(videoReferenceLabels(refs), ["@video_1", "@image_1", "@image_2", "@video_2"]);
  for (const prompt of ["Use @image_2, then @video_1.", "@image_1里的猫", "Use all references"]) assert.equal(videoReferencePromptIssue("Kling 4.0", prompt, refs), undefined);
  for (const prompt of ["@Hero", "@first_frame", "@image_3", "@image_10", "@image_1_extra", "test@example.com", "@video_2abc"]) assert.ok(videoReferencePromptIssue("Kling 4.0", prompt, refs), prompt);
  assert.ok(videoReferencePromptIssue("Kling 4.0", "@image_2", refs.filter((_, index) => index !== 2)));
  assert.equal(videoReferencePromptIssue("Seedance 2.0 Mini", "test@example.com", []), undefined);
});

test("Agent quotes the approved image prices and Kling references while refusing 2.5 and unsupported features", () => {
  for (const version of ["flare", "sunburst"]) for (const [resolution, price] of Object.entries({ "1K": 2, "2K": 3, "4K": 5 })) for (const count of [1, 4]) {
    const quote = buildQuote({ ...proposal, type: "image", model: `gpt-image-2-6-${version}`, resolution, count }, Array(16).fill(image), { userText: "" });
    assert.equal(quote.unitCredits, price); assert.equal(quote.credits, price * count);
  }
  for (const model of ["GPT Image 2.5 Flare", "GPT-Image-2.5 Flare", "gpt-image-2-5-sunburst"]) assert.throws(() => buildQuote({ ...proposal, type: "image", model }, [], { userText: "" }), /available/);
  const q = buildQuote({ ...proposal, prompt: "Use @image_1 and @video_1", duration: 10 }, [image, clip(5)], { userText: "" });
  assert.equal(q.modelId, "kling40_720_10"); assert.equal(q.credits, 68); assert.equal(q.sound, true);
  assert.equal(buildQuote(proposal, [], { userText: "" }).duration, 5);
  for (const params of [{ sound: false }, { prompt: "Use @Hero" }, { prompt: "Use @first_frame" }, { resolution: "4K" }, { aspectRatio: "4:3" }, { duration: 2 }, { count: 2 }]) assert.throws(() => buildQuote({ ...proposal, ...params }, [], { userText: "", maxVideoResolution: "4K" }));
});

test("already accepted legacy template and Agent images dispatch the saved model after the default changes", async () => {
  const calls: string[] = [];
  const worker = createSourceLoader({
    "@/lib/image-generation-provider": { createImageTask: async ({ modelId }: { modelId: string }) => { calls.push(modelId); throw new Error("Stop before external I/O"); } },
    "@/lib/generation-lifecycle": { failGeneration: async () => undefined },
  })<typeof import("../lib/image-templates/worker")>("lib/image-templates/worker.ts");
  for (const [providerId, parameters, expected] of [
    ["gpt-image-2-5-sunburst-text-to-image", {}, "gpt-image-2-5-sunburst"],
    ["gpt-image-2-5-flare-image-to-image", { agentImageModel: "gpt-image-2-5-flare" }, "gpt-image-2-5-flare"],
    ["gpt-image-2-6/sunburst-image-to-image", {}, "gpt-image-2-6-sunburst"],
  ] as const) {
    await worker.executeTemplateOutput({ id: "owner", accountCreatedAt: "2026-01-01T00:00:00Z" }, { id: "accepted", modelOptionId: providerId, parameters, inputUrls: [], prompt: "Original" } as never);
    assert.equal(calls.at(-1), expected);
  }
});
