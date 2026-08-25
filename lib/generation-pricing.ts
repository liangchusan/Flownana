export type VideoModelOptionId = string;

type VideoModelFamily = "kling" | "veo" | "happyhorse" | "grok" | "minimax" | "seedance";
export type VideoProvider = "kie" | "volcengine";
export type VideoAspectRatio =
  | "Auto"
  | "16:9"
  | "9:16"
  | "1:1"
  | "4:3"
  | "3:4"
  | "21:9"
  | "3:2"
  | "2:3";
export type VideoResolutionOption = "Auto" | "480P" | "720P" | "1080P" | "2K" | "4K";
export type VideoSoundOption = "Auto" | "On" | "Off";
export const KIE_VIDEO_CREDIT_MULTIPLIER = 0.2;

export type VideoModelOption = {
  id: VideoModelOptionId;
  label: string;
  family: VideoModelFamily;
  provider: VideoProvider;
  providerModel: string;
  imageToVideoProviderModel?: string;
  requiresImageInput?: boolean;
  resolution: "480P" | "720P" | "1080P" | "2K" | "4K" | "/";
  duration: number;
  hasAudio?: boolean;
  aspectRatios?: VideoAspectRatio[];
  credits: number;
};

export function getVideoModelName(option: VideoModelOption): string {
  if (option.family === "seedance") return "Seedance 2.0 Mini";
  if (option.providerModel.startsWith("happyhorse-1-1/")) return "HappyHorse 1.1";
  if (option.family === "grok") return "Grok Imagine Video 1.5";
  if (option.family === "minimax") return "MiniMax H3";
  return option.label.split(" · ")[0] || option.label;
}

const platformVideoCredits = (
  apiCreditsPerSecond: number,
  duration: VideoModelOption["duration"]
) => Math.round(apiCreditsPerSecond * duration * KIE_VIDEO_CREDIT_MULTIPLIER);

const HAPPYHORSE_DURATIONS = Array.from({ length: 13 }, (_, index) => index + 3);
const GROK_DURATIONS = Array.from({ length: 15 }, (_, index) => index + 1);
const MINIMAX_H3_DURATIONS = Array.from({ length: 12 }, (_, index) => index + 4);
const SEEDANCE_MINI_DURATIONS = Array.from({ length: 12 }, (_, index) => index + 4);
export const DEFAULT_VIDEO_ASPECT_RATIOS: VideoAspectRatio[] = [
  "Auto",
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "21:9",
];
export const DEFAULT_VIDEO_RESOLUTIONS: VideoResolutionOption[] = [
  "Auto",
  "480P",
  "720P",
  "1080P",
  "2K",
  "4K",
];
export const DEFAULT_VIDEO_SOUND_OPTIONS: VideoSoundOption[] = ["Auto", "On", "Off"];

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function formatVideoResolution(
  resolution: VideoModelOption["resolution"]
): VideoResolutionOption {
  return resolution === "/" ? "Auto" : resolution;
}

export function getDisplayAspectRatios(options: VideoModelOption[]): VideoAspectRatio[] {
  const supported = unique(
    options.flatMap((option) => option.aspectRatios || DEFAULT_VIDEO_ASPECT_RATIOS)
  );
  return DEFAULT_VIDEO_ASPECT_RATIOS.filter((ratio) => supported.includes(ratio));
}

export function getDisplayResolutions(options: VideoModelOption[]): VideoResolutionOption[] {
  const supported = unique(options.map((option) => formatVideoResolution(option.resolution)));
  return DEFAULT_VIDEO_RESOLUTIONS.filter((resolution) => supported.includes(resolution));
}

export function getDisplaySoundOptions(options: VideoModelOption[]): VideoSoundOption[] {
  if (options.length > 0 && options.every((option) => option.family === "seedance")) {
    return ["On", "Off"];
  }
  const supportsAudioOn = options.some((option) => option.hasAudio);
  const supportsAudioOff = options.some((option) => !option.hasAudio);

  if (supportsAudioOn && supportsAudioOff) {
    return DEFAULT_VIDEO_SOUND_OPTIONS;
  }
  if (supportsAudioOn) {
    return ["On"];
  }
  return [];
}

function createHappyHorse11Options(): VideoModelOption[] {
  const priceByResolution: Partial<Record<VideoModelOption["resolution"], number>> = {
    "720P": 22,
    "1080P": 34,
  };

  return Object.entries(priceByResolution).flatMap(
    ([resolution, apiCreditsPerSecond]) =>
      HAPPYHORSE_DURATIONS.map((duration) => ({
        id: `happyhorse11_${resolution.toLowerCase().replace("p", "")}_${duration}`,
        label: `HappyHorse 1.1 · ${resolution} · ${duration}s`,
        family: "happyhorse",
        provider: "kie",
        providerModel: "happyhorse-1-1/text-to-video",
        imageToVideoProviderModel: "happyhorse-1-1/image-to-video",
        resolution: resolution as VideoModelOption["resolution"],
        duration,
        aspectRatios: DEFAULT_VIDEO_ASPECT_RATIOS,
        credits: platformVideoCredits(apiCreditsPerSecond, duration),
      }))
  );
}

function createGrokImagineVideo15Options(): VideoModelOption[] {
  const priceByResolution: Partial<Record<VideoModelOption["resolution"], number>> = {
    "480P": 14.5,
    "720P": 25,
  };

  return Object.entries(priceByResolution).flatMap(
    ([resolution, apiCreditsPerSecond]) =>
      GROK_DURATIONS.map((duration) => ({
        id: `grok15_${resolution.toLowerCase().replace("p", "")}_${duration}`,
        label: `Grok Imagine Video 1.5 · ${resolution} · ${duration}s`,
        family: "grok",
        provider: "kie",
        providerModel: "grok-imagine-video-1-5-preview",
        imageToVideoProviderModel: "grok-imagine-video-1-5-preview",
        requiresImageInput: true,
        resolution: resolution as VideoModelOption["resolution"],
        duration,
        aspectRatios: DEFAULT_VIDEO_ASPECT_RATIOS,
        credits: platformVideoCredits(apiCreditsPerSecond, duration),
      }))
  );
}

function createMiniMaxH3Options(): VideoModelOption[] {
  const priceByResolution: Partial<Record<VideoModelOption["resolution"], number>> = {
    "720P": 18,
    "2K": 29,
  };

  return Object.entries(priceByResolution).flatMap(
    ([resolution, apiCreditsPerSecond]) =>
      MINIMAX_H3_DURATIONS.map((duration) => ({
        id: `minimaxh3_${resolution.toLowerCase().replace("p", "")}_${duration}`,
        label: `MiniMax H3 · ${resolution} · ${duration}s`,
        family: "minimax",
        provider: "kie",
        providerModel: "minimax-h3/text-to-video",
        imageToVideoProviderModel: "minimax-h3/image-to-video",
        resolution: resolution as VideoModelOption["resolution"],
        duration,
        aspectRatios: DEFAULT_VIDEO_ASPECT_RATIOS,
        credits: platformVideoCredits(apiCreditsPerSecond, duration),
      }))
  );
}

function createSeedanceMiniOptions(): VideoModelOption[] {
  // KIE's no-video-input tiers are used for every input combination.
  const apiCreditsPerSecond: Record<"480P" | "720P", number> = {
    "480P": 10,
    "720P": 22,
  };

  return (["480P", "720P"] as const).flatMap((resolution) =>
    SEEDANCE_MINI_DURATIONS.map((duration) => ({
      id: `seedance2mini_${resolution.toLowerCase().replace("p", "")}_${duration}`,
      label: `Seedance 2.0 Mini · ${resolution} · ${duration}s`,
      family: "seedance" as const,
      provider: "kie" as const,
      providerModel: "bytedance/seedance-2-mini",
      resolution,
      duration,
      hasAudio: true,
      aspectRatios: DEFAULT_VIDEO_ASPECT_RATIOS,
      credits: platformVideoCredits(apiCreditsPerSecond[resolution], duration),
    }))
  );
}

export const VIDEO_MODEL_OPTIONS: VideoModelOption[] = [
  ...createSeedanceMiniOptions(),
  ...createMiniMaxH3Options(),
  ...createGrokImagineVideo15Options(),
  ...createHappyHorse11Options(),
];

export const VIDEO_MODEL_OPTION_MAP: Record<VideoModelOptionId, VideoModelOption> =
  VIDEO_MODEL_OPTIONS.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<VideoModelOptionId, VideoModelOption>);

export type ImageResolutionKey = "1K" | "2K" | "4K";
export type ImageModelOptionId = "gpt-image-2" | "nano-banana-2" | "qwen-image-3-pro";

export type ImageModelOption = {
  id: ImageModelOptionId;
  label: string;
  textToImageModel: string;
  imageToImageModel: string;
  credits: Partial<Record<ImageResolutionKey, number>>;
  resolutions?: ImageResolutionKey[];
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
  {
    id: "qwen-image-3-pro",
    label: "Qwen Image 3.0 Pro",
    textToImageModel: "qwen3/pro-text-to-image",
    imageToImageModel: "qwen3/pro-image-to-image",
    resolutions: ["1K", "2K"],
    credits: {
      "1K": Math.round(6.4 * 0.3),
      "2K": Math.round(12 * 0.3),
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
