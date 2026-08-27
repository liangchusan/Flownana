import type { ImageModelOptionId } from "./generation-pricing";

export type ComposerAttachmentKind = "image" | "video" | "audio";

export interface GenerationInputCapabilities {
  maxImages: number;
  maxImageBytes: number;
  imageRequired: boolean;
  imageRoles: string[];
  acceptsVideo: boolean;
  acceptsAudio: boolean;
  maxVideos: number;
  maxVideoBytes: number;
  maxAudios: number;
  maxAudioBytes: number;
}

const DEFAULT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const QWEN_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export function getImageInputCapabilities(
  modelId: ImageModelOptionId
): GenerationInputCapabilities {
  if (modelId === "qwen-image-3-pro") {
    return {
      maxImages: 3,
      maxImageBytes: QWEN_MAX_IMAGE_BYTES,
      imageRequired: false,
      imageRoles: ["Reference 1", "Reference 2", "Reference 3"],
      acceptsVideo: false,
      acceptsAudio: false,
      maxVideos: 0,
      maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES,
      maxAudios: 0,
      maxAudioBytes: DEFAULT_MAX_AUDIO_BYTES,
    };
  }

  return {
    maxImages: 1,
    maxImageBytes: DEFAULT_MAX_IMAGE_BYTES,
    imageRequired: false,
    imageRoles: ["Reference image"],
    acceptsVideo: false,
    acceptsAudio: false,
    maxVideos: 0,
    maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES,
    maxAudios: 0,
    maxAudioBytes: DEFAULT_MAX_AUDIO_BYTES,
  };
}

export function getVideoInputCapabilities(
  modelName: string
): GenerationInputCapabilities {
  if (modelName === "Gemini Omni Video") {
    return {
      maxImages: 7,
      maxImageBytes: 10 * 1024 * 1024,
      imageRequired: false,
      imageRoles: Array.from({ length: 7 }, (_, index) => `Reference ${index + 1}`),
      acceptsVideo: false,
      acceptsAudio: false,
      maxVideos: 0,
      maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES,
      maxAudios: 0,
      maxAudioBytes: DEFAULT_MAX_AUDIO_BYTES,
    };
  }
  if (modelName === "Wan 3.0 Video") {
    return {
      maxImages: 10,
      maxImageBytes: DEFAULT_MAX_IMAGE_BYTES,
      imageRequired: false,
      imageRoles: Array.from({ length: 10 }, (_, index) =>
        index === 0 ? "First frame / Reference 1" : index === 1 ? "Last frame / Reference 2" : `Reference ${index + 1}`
      ),
      acceptsVideo: true,
      acceptsAudio: true,
      // Conservative P0 limits keep total reference duration within KIE's 15s cap.
      maxVideos: 1,
      maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES,
      maxAudios: 1,
      maxAudioBytes: DEFAULT_MAX_AUDIO_BYTES,
    };
  }
  if (modelName === "Seedance 2.0 Mini") {
    return {
      maxImages: 9,
      maxImageBytes: 30 * 1024 * 1024,
      imageRequired: false,
      imageRoles: Array.from({ length: 9 }, (_, index) => `Reference ${index + 1}`),
      acceptsVideo: true,
      acceptsAudio: true,
      maxVideos: 3,
      maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES,
      maxAudios: 3,
      maxAudioBytes: DEFAULT_MAX_AUDIO_BYTES,
    };
  }
  if (modelName === "MiniMax H3") {
    return {
      maxImages: 2,
      maxImageBytes: DEFAULT_MAX_IMAGE_BYTES,
      imageRequired: false,
      imageRoles: ["First frame", "Last frame"],
      acceptsVideo: false,
      acceptsAudio: false,
      maxVideos: 0,
      maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES,
      maxAudios: 0,
      maxAudioBytes: DEFAULT_MAX_AUDIO_BYTES,
    };
  }

  return {
    maxImages: 1,
    maxImageBytes: DEFAULT_MAX_IMAGE_BYTES,
    imageRequired: modelName === "Grok Imagine Video 1.5",
    imageRoles: ["Opening reference"],
    acceptsVideo: false,
    acceptsAudio: false,
    maxVideos: 0,
    maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES,
    maxAudios: 0,
    maxAudioBytes: DEFAULT_MAX_AUDIO_BYTES,
  };
}

export function getAttachmentLimit(
  capabilities: GenerationInputCapabilities,
  kind: ComposerAttachmentKind
) {
  if (kind === "image") return capabilities.maxImages;
  if (kind === "video") return capabilities.maxVideos;
  return capabilities.maxAudios;
}

export function hasTooManyImageInputs(
  capabilities: GenerationInputCapabilities,
  imageCount: number
) {
  return imageCount > capabilities.maxImages;
}
