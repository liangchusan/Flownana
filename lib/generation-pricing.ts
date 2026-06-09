export type VideoModelOptionId = string;

type VideoModelFamily = "kling" | "veo" | "seedance" | "happyhorse";

export type VideoModelOption = {
  id: VideoModelOptionId;
  label: string;
  family: VideoModelFamily;
  providerModel: string;
  resolution: "480P" | "720P" | "1080P" | "/";
  duration: number;
  hasAudio?: boolean;
  credits: number;
};

const platformVideoCredits = (
  apiCreditsPerSecond: number,
  duration: VideoModelOption["duration"]
) => Math.round(apiCreditsPerSecond * duration * 0.3);

const SEEDANCE_DURATIONS = Array.from({ length: 12 }, (_, index) => index + 4);
const HAPPYHORSE_DURATIONS = Array.from({ length: 13 }, (_, index) => index + 3);

function createSeedanceOptions(params: {
  idPrefix: string;
  label: string;
  providerModel: string;
  priceByResolution: Partial<Record<VideoModelOption["resolution"], number>>;
}): VideoModelOption[] {
  return Object.entries(params.priceByResolution).flatMap(
    ([resolution, apiCreditsPerSecond]) =>
      SEEDANCE_DURATIONS.flatMap((duration) =>
        ([false, true] as const).map((hasAudio) => ({
          id: `${params.idPrefix}_${resolution.toLowerCase().replace("p", "")}${
            hasAudio ? "_audio" : ""
          }_${duration}`,
          label: `${params.label} · ${resolution}${hasAudio ? "(有声音)" : ""} · ${duration}s`,
          family: "seedance",
          providerModel: params.providerModel,
          resolution: resolution as VideoModelOption["resolution"],
          duration,
          hasAudio: hasAudio || undefined,
          credits: platformVideoCredits(apiCreditsPerSecond, duration),
        }))
      )
  );
}

function createHappyHorseOptions(): VideoModelOption[] {
  const priceByResolution: Partial<Record<VideoModelOption["resolution"], number>> = {
    "720P": 28,
    "1080P": 48,
  };

  return Object.entries(priceByResolution).flatMap(
    ([resolution, apiCreditsPerSecond]) =>
      HAPPYHORSE_DURATIONS.map((duration) => ({
        id: `happyhorse10_${resolution.toLowerCase().replace("p", "")}_${duration}`,
        label: `HappyHorse 1.0 · ${resolution} · ${duration}s`,
        family: "happyhorse",
        providerModel: "happyhorse/text-to-video",
        resolution: resolution as VideoModelOption["resolution"],
        duration,
        credits: platformVideoCredits(apiCreditsPerSecond, duration),
      }))
  );
}

const KLING_API_CREDITS_PER_SECOND = {
  standard: {
    noAudio: 14,
    audio: 20,
  },
  pro: {
    noAudio: 18,
    audio: 27,
  },
};

export const VIDEO_MODEL_OPTIONS: VideoModelOption[] = [
  { id: "kling30_720_8", label: "Kling 3.0 · 720P · 8s", family: "kling", providerModel: "kling-3.0/video", resolution: "720P", duration: 8, credits: platformVideoCredits(KLING_API_CREDITS_PER_SECOND.standard.noAudio, 8) },
  { id: "kling30_720_15", label: "Kling 3.0 · 720P · 15s", family: "kling", providerModel: "kling-3.0/video", resolution: "720P", duration: 15, credits: platformVideoCredits(KLING_API_CREDITS_PER_SECOND.standard.noAudio, 15) },
  { id: "kling30_1080_8", label: "Kling 3.0 · 1080P · 8s", family: "kling", providerModel: "kling-3.0/video", resolution: "1080P", duration: 8, credits: platformVideoCredits(KLING_API_CREDITS_PER_SECOND.pro.noAudio, 8) },
  { id: "kling30_1080_15", label: "Kling 3.0 · 1080P · 15s", family: "kling", providerModel: "kling-3.0/video", resolution: "1080P", duration: 15, credits: platformVideoCredits(KLING_API_CREDITS_PER_SECOND.pro.noAudio, 15) },
  { id: "kling30_720_audio_8", label: "Kling 3.0 · 720P(有声音) · 8s", family: "kling", providerModel: "kling-3.0/video", resolution: "720P", duration: 8, hasAudio: true, credits: platformVideoCredits(KLING_API_CREDITS_PER_SECOND.standard.audio, 8) },
  { id: "kling30_720_audio_15", label: "Kling 3.0 · 720P(有声音) · 15s", family: "kling", providerModel: "kling-3.0/video", resolution: "720P", duration: 15, hasAudio: true, credits: platformVideoCredits(KLING_API_CREDITS_PER_SECOND.standard.audio, 15) },
  { id: "kling30_1080_audio_8", label: "Kling 3.0 · 1080P(有声音) · 8s", family: "kling", providerModel: "kling-3.0/video", resolution: "1080P", duration: 8, hasAudio: true, credits: platformVideoCredits(KLING_API_CREDITS_PER_SECOND.pro.audio, 8) },
  { id: "kling30_1080_audio_15", label: "Kling 3.0 · 1080P(有声音) · 15s", family: "kling", providerModel: "kling-3.0/video", resolution: "1080P", duration: 15, hasAudio: true, credits: platformVideoCredits(KLING_API_CREDITS_PER_SECOND.pro.audio, 15) },
  { id: "veo31_lite_8", label: "VEO 3.1 Lite · 8s", family: "veo", providerModel: "veo3_lite", resolution: "/", duration: 8, credits: Math.round(30 * 0.3) },
  { id: "veo31_fast_8", label: "VEO 3.1 Fast · 8s", family: "veo", providerModel: "veo3_fast", resolution: "/", duration: 8, credits: Math.round(60 * 0.3) },
  { id: "veo31_quality_8", label: "VEO 3.1 Quality · 8s", family: "veo", providerModel: "veo3", resolution: "/", duration: 8, credits: Math.round(250 * 0.3) },
  ...createSeedanceOptions({
    idPrefix: "seedance20",
    label: "Seedance 2",
    providerModel: "bytedance/seedance-2",
    priceByResolution: {
      "480P": 19,
      "720P": 41,
      "1080P": 102,
    },
  }),
  ...createSeedanceOptions({
    idPrefix: "seedance20fast",
    label: "Seedance 2 Fast",
    providerModel: "bytedance/seedance-2-fast",
    priceByResolution: {
      "480P": 15.5,
      "720P": 33,
    },
  }),
  ...createHappyHorseOptions(),
];

export const VIDEO_MODEL_OPTION_MAP: Record<VideoModelOptionId, VideoModelOption> =
  VIDEO_MODEL_OPTIONS.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<VideoModelOptionId, VideoModelOption>);

export type ImageResolutionKey = "1K" | "2K" | "4K";
export type ImageModelOptionId = "gpt-image-2" | "nano-banana-2";

export type ImageModelOption = {
  id: ImageModelOptionId;
  label: string;
  textToImageModel: string;
  imageToImageModel: string;
  credits: Record<ImageResolutionKey, number>;
};

export const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  {
    id: "gpt-image-2",
    label: "GPT Image 2",
    textToImageModel: "gpt-image-2-text-to-image",
    imageToImageModel: "gpt-image-2-image-to-image",
    credits: {
      "1K": 2,
      "2K": 3,
      "4K": 5,
    },
  },
  {
    id: "nano-banana-2",
    label: "Nano Banana 2",
    textToImageModel: "nano-banana-2",
    imageToImageModel: "nano-banana-2",
    credits: {
      "1K": 2,
      "2K": 4,
      "4K": 5,
    },
  },
];

export const IMAGE_MODEL_OPTION_MAP: Record<ImageModelOptionId, ImageModelOption> =
  IMAGE_MODEL_OPTIONS.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<ImageModelOptionId, ImageModelOption>);

export const IMAGE_RESOLUTION_CREDITS: Record<ImageResolutionKey, number> = {
  "1K": 2,
  "2K": 3,
  "4K": 5,
};

export function getImageGenerationCredits(
  modelId: string | undefined,
  resolution: ImageResolutionKey
) {
  const option =
    IMAGE_MODEL_OPTION_MAP[modelId as ImageModelOptionId] ||
    IMAGE_MODEL_OPTION_MAP["gpt-image-2"];
  return option.credits[resolution];
}
