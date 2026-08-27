import assert from "node:assert/strict";
import test from "node:test";
import { VIDEO_MODEL_OPTION_MAP } from "../lib/generation-pricing.ts";
import {
  getGrokVideoInput,
  getGeminiOmniVideoInput,
  getHappyHorseVideoInput,
  getKieVideoAspectRatio,
  getKieMarketVideoTaskBody,
  getKieVideoResolution,
  getMiniMaxVideoInput,
  getSeedanceMiniVideoInput,
  getWan30VideoInput,
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

test("Seedance Mini keeps pure two-image input in first-and-last-frame mode", () => {
  const input = getSeedanceMiniVideoInput({
    prompt: "move naturally",
    inputs: [
      { kind: "image", url: "https://example.com/first.png" },
      { kind: "image", url: "https://example.com/last.png" },
    ],
    aspectRatio: "Auto",
    generateAudio: false,
    option: VIDEO_MODEL_OPTION_MAP.seedance2mini_480_4,
  });

  assert.deepEqual(input, {
    prompt: "move naturally",
    resolution: "480p",
    duration: 4,
    generate_audio: false,
    aspect_ratio: "adaptive",
    web_search: false,
    nsfw_checker: true,
    first_frame_url: "https://example.com/first.png",
    last_frame_url: "https://example.com/last.png",
  });
  assert.equal("reference_image_urls" in input, false);
});

test("Seedance Mini uses mutually exclusive multimodal reference arrays", () => {
  const body = getKieMarketVideoTaskBody({
    prompt: "use every reference",
    inputs: [
      { kind: "image", url: "https://example.com/image.png" },
      { kind: "video", url: "https://example.com/video.mp4" },
      { kind: "audio", url: "https://example.com/audio.mp3" },
    ],
    aspectRatio: "21:9",
    generateAudio: true,
    option: VIDEO_MODEL_OPTION_MAP.seedance2mini_720_15,
  });

  assert.deepEqual(body, {
    model: "bytedance/seedance-2-mini",
    input: {
      prompt: "use every reference",
      resolution: "720p",
      duration: 15,
      generate_audio: true,
      aspect_ratio: "21:9",
      web_search: false,
      nsfw_checker: true,
      reference_image_urls: ["https://example.com/image.png"],
      reference_video_urls: ["https://example.com/video.mp4"],
      reference_audio_urls: ["https://example.com/audio.mp3"],
    },
  });
  assert.equal("first_frame_url" in body.input, false);
  assert.equal("last_frame_url" in body.input, false);
});

test("Gemini Omni sends documented text and image-reference fields", () => {
  const input = getGeminiOmniVideoInput({
    prompt: "keep the character consistent",
    imageUrls: [
      "https://example.com/character.png",
      "https://example.com/scene.png",
    ],
    aspectRatio: "9:16",
    option: VIDEO_MODEL_OPTION_MAP.geminiomni_4k_8,
  });

  assert.deepEqual(input, {
    prompt: "keep the character consistent",
    duration: "8",
    aspect_ratio: "9:16",
    resolution: "4k",
    image_urls: [
      "https://example.com/character.png",
      "https://example.com/scene.png",
    ],
  });
});

test("Wan 3.0 keeps pure two-image input in first-and-last-frame mode", () => {
  const input = getWan30VideoInput({
    prompt: "transition between the frames",
    inputs: [
      { kind: "image", url: "https://example.com/first.png" },
      { kind: "image", url: "https://example.com/last.png" },
    ],
    aspectRatio: "Auto",
    generateAudio: false,
    option: VIDEO_MODEL_OPTION_MAP.wan30_720_10,
  });

  assert.deepEqual(input, {
    prompt: "transition between the frames",
    resolution: "720P",
    aspect_ratio: "adaptive",
    duration: 10,
    audio: false,
    nsfw_checker: true,
    first_frame_url: "https://example.com/first.png",
    last_frame_url: "https://example.com/last.png",
  });
  assert.equal("reference_image_urls" in input, false);
});

test("Wan 3.0 uses mutually exclusive multimodal reference arrays", () => {
  const body = getKieMarketVideoTaskBody({
    prompt: "use every reference",
    inputs: [
      { kind: "image", url: "https://example.com/image.png" },
      { kind: "video", url: "https://example.com/video.mp4" },
      { kind: "audio", url: "https://example.com/audio.mp3" },
    ],
    aspectRatio: "3:4",
    generateAudio: true,
    option: VIDEO_MODEL_OPTION_MAP.wan30_1080_15,
  });

  assert.deepEqual(body, {
    model: "wan/3-0-video",
    input: {
      prompt: "use every reference",
      resolution: "1080P",
      aspect_ratio: "3:4",
      duration: 15,
      audio: true,
      nsfw_checker: true,
      reference_image_urls: ["https://example.com/image.png"],
      reference_video_urls: ["https://example.com/video.mp4"],
      reference_audio_urls: ["https://example.com/audio.mp3"],
    },
  });
  assert.equal("first_frame_url" in body.input, false);
  assert.equal("last_frame_url" in body.input, false);
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
