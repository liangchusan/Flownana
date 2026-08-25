import assert from "node:assert/strict";
import test from "node:test";
import { VIDEO_MODEL_OPTION_MAP } from "../lib/generation-pricing.ts";
import { buildVolcengineVideoTaskBody, parseVolcengineVideoResult } from "../lib/volcengine-video-request.ts";

test("Volcengine request maps multimodal references and adaptive ratio", () => {
  const body = buildVolcengineVideoTaskBody({
    prompt: "Create a launch film",
    inputs: [
      { kind: "image", url: "https://example.com/a.jpg" },
      { kind: "video", url: "https://example.com/b.mp4" },
      { kind: "audio", url: "https://example.com/c.mp3" },
    ],
    generateAudio: true,
    option: {
      ...VIDEO_MODEL_OPTION_MAP.seedance2mini_480_4,
      provider: "volcengine",
      providerModel: "doubao-seedance-2-0-mini-260615",
    },
  });
  assert.equal(body.model, "doubao-seedance-2-0-mini-260615");
  assert.equal(body.resolution, "480p");
  assert.equal(body.ratio, "adaptive");
  assert.deepEqual(body.content.map((item) => item.role).filter(Boolean), ["reference_image", "reference_video", "reference_audio"]);
});

test("Volcengine result parser handles success and failure", () => {
  assert.deepEqual(parseVolcengineVideoResult({ status: "succeeded", content: { video_url: "https://example.com/out.mp4" } }), { state: "success", url: "https://example.com/out.mp4" });
  assert.equal(parseVolcengineVideoResult({ status: "failed", error: { message: "blocked" } }).state, "failed");
});
