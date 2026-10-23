import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";
import type { CreationHistoryItem } from "../lib/creation-history.ts";

const load = createSourceLoader({});
const { getCreationParameters } = load<typeof import("../lib/creation-details")>("lib/creation-details.ts");

function creation(type: "image" | "video", modelOptionId: string, parameters?: CreationHistoryItem["parameters"]): CreationHistoryItem {
  return { id: "historical-fixture", type, modelOptionId, parameters, prompt: "Original prompt", urls: [], inputUrls: [], status: "success", createdAt: "2026-09-01T00:00:00.000Z" };
}

test("retired image provider IDs still resolve to their original model names", () => {
  for (const [id, name] of [
    ["gpt-image-2-image-to-image", "GPT Image 2"],
    ["nano-banana-2", "Nano Banana 2"],
    ["qwen3/pro-image-to-image", "Qwen Image 3.0 Pro"],
    ["seedream/5-pro-text-to-image", "Seedream 5.0 Pro"],
  ]) assert.equal(getCreationParameters(creation("image", id))?.model, name);
});

test("model retirement and official renaming do not rewrite saved historical parameters", () => {
  const parameters = { model: "GPT-Image-2.5 Flare", resolution: "2K", aspectRatio: "3:2", outputCount: 4 };
  const oldImage = creation("image", "gpt-image-2-5-flare-image-to-image", parameters);
  const before = JSON.stringify(oldImage);
  assert.deepEqual(getCreationParameters(oldImage), { ...parameters, duration: undefined, processingDurationMs: undefined, audio: undefined, mode: undefined });
  assert.equal(JSON.stringify(oldImage), before);
  const oldVideo = creation("video", "geminiomni_720_4", { model: "Gemini Omni Video", resolution: "720P", duration: 4, aspectRatio: "16:9", audio: "On" });
  assert.equal(getCreationParameters(oldVideo)?.model, "Gemini Omni Video");
  assert.equal(getCreationParameters(oldVideo)?.duration, 4);
  assert.equal(getCreationParameters(creation("video", "happyhorse11_720_3"))?.model, "HappyHorse 1.1");
});
