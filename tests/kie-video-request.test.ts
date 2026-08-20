import assert from "node:assert/strict";
import test from "node:test";
import { VIDEO_MODEL_OPTION_MAP } from "../lib/generation-pricing.ts";
import {
  getGrokVideoInput,
  getHappyHorseVideoInput,
  getKieVideoAspectRatio,
  getKieMarketVideoTaskBody,
  getKieVideoResolution,
  getMiniMaxVideoInput,
} from "../lib/kie-video-request.ts";

test("Auto aspect ratio falls back for text-to-video but not image-to-video", () => {
  assert.equal(
    getKieVideoAspectRatio({ aspectRatio: "Auto", hasImageInput: false }),
    "16:9"
  );
  assert.equal(
    getKieVideoAspectRatio({ aspectRatio: "Auto", hasImageInput: true }),
    undefined
  );
  assert.equal(
    getKieVideoAspectRatio({ aspectRatio: "9:16", hasImageInput: true }),
    undefined
  );
});

test("MiniMax H3 720P display tier maps to KIE 768P", () => {
  assert.equal(
    getKieVideoResolution(VIDEO_MODEL_OPTION_MAP.minimaxh3_720_15),
    "768P"
  );
  assert.equal(
    getKieVideoResolution(VIDEO_MODEL_OPTION_MAP.minimaxh3_2k_15),
    "2K"
  );
});

test("HappyHorse image-to-video uses image_urls input", () => {
  const input = getHappyHorseVideoInput({
    prompt: "move naturally",
    imageUrls: ["https://example.com/input.png"],
    option: VIDEO_MODEL_OPTION_MAP.happyhorse11_720_15,
  });

  assert.deepEqual(input, {
    prompt: "move naturally",
    resolution: "720p",
    duration: 15,
    image_urls: ["https://example.com/input.png"],
  });
});

test("MiniMax H3 image-to-video supports first and last frame inputs", () => {
  const input = getMiniMaxVideoInput({
    prompt: "move naturally",
    imageUrls: [
      "https://example.com/first.png",
      "https://example.com/last.png",
    ],
    option: VIDEO_MODEL_OPTION_MAP.minimaxh3_720_15,
  });

  assert.deepEqual(input, {
    prompt: "move naturally",
    resolution: "768P",
    duration: 15,
    first_frame_url: "https://example.com/first.png",
    last_frame_url: "https://example.com/last.png",
  });
  assert.equal("image_urls" in input, false);
});

test("Grok image-to-video sends image_urls only after an image is provided", () => {
  const input = getGrokVideoInput({
    prompt: "move naturally",
    imageUrls: ["https://example.com/input.png"],
    aspectRatio: "9:16",
    option: VIDEO_MODEL_OPTION_MAP.grok15_720_15,
  });

  assert.deepEqual(input, {
    prompt: "move naturally",
    image_urls: ["https://example.com/input.png"],
    resolution: "720p",
    duration: 15,
    nsfw_checker: true,
    aspect_ratio: "9:16",
  });
});

test("active KIE video models use their documented request contracts", () => {
  assert.deepEqual(
    getKieMarketVideoTaskBody({
      prompt: "move naturally",
      imageUrls: ["https://example.com/input.png"],
      aspectRatio: "9:16",
      option: VIDEO_MODEL_OPTION_MAP.minimaxh3_720_15,
    }),
    {
      model: "minimax-h3/image-to-video",
      input: {
        prompt: "move naturally",
        resolution: "768P",
        duration: 15,
        first_frame_url: "https://example.com/input.png",
      },
    }
  );

  assert.deepEqual(
    getKieMarketVideoTaskBody({
      prompt: "move naturally",
      imageUrls: ["https://example.com/input.png"],
      aspectRatio: "9:16",
      option: VIDEO_MODEL_OPTION_MAP.grok15_720_15,
    }),
    {
      model: "grok-imagine-video-1-5-preview",
      input: {
        prompt: "move naturally",
        image_urls: ["https://example.com/input.png"],
        resolution: "720p",
        duration: 15,
        nsfw_checker: true,
      },
    }
  );

  assert.deepEqual(
    getKieMarketVideoTaskBody({
      prompt: "move naturally",
      imageUrls: ["https://example.com/input.png"],
      aspectRatio: "9:16",
      option: VIDEO_MODEL_OPTION_MAP.happyhorse11_1080_15,
    }),
    {
      model: "happyhorse-1-1/image-to-video",
      input: {
        prompt: "move naturally",
        resolution: "1080p",
        duration: 15,
        image_urls: ["https://example.com/input.png"],
      },
    }
  );
});
