import type { ImageModelOptionId } from "./generation-pricing";

export type ComposerAttachmentKind = "image" | "video" | "audio";

export interface GenerationInputCapabilities {
  maxImages: number;
  maxImageBytes: number;
  imageRequired: boolean;
  imageRoles: string[];
  acceptsVideo: boolean;
  acceptsAudio: boolean;
}

const DEFAULT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const QWEN_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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
    };
  }

  return {
    maxImages: 1,
    maxImageBytes: DEFAULT_MAX_IMAGE_BYTES,
    imageRequired: false,
    imageRoles: ["Reference image"],
    acceptsVideo: false,
    acceptsAudio: false,
  };
}

export function getVideoInputCapabilities(
  modelName: string
): GenerationInputCapabilities {
  if (modelName === "MiniMax H3") {
    return {
      maxImages: 2,
      maxImageBytes: DEFAULT_MAX_IMAGE_BYTES,
      imageRequired: false,
      imageRoles: ["First frame", "Last frame"],
      acceptsVideo: false,
      acceptsAudio: false,
    };
  }

  return {
    maxImages: 1,
    maxImageBytes: DEFAULT_MAX_IMAGE_BYTES,
    imageRequired: modelName === "Grok Imagine Video 1.5",
    imageRoles: ["Opening reference"],
    acceptsVideo: false,
    acceptsAudio: false,
  };
}

export function getAttachmentLimit(
  capabilities: GenerationInputCapabilities,
  kind: ComposerAttachmentKind
) {
  if (kind === "image") return capabilities.maxImages;
  if (kind === "video") return capabilities.acceptsVideo ? 1 : 0;
  return capabilities.acceptsAudio ? 1 : 0;
}

export function hasTooManyImageInputs(
  capabilities: GenerationInputCapabilities,
  imageCount: number
) {
  return imageCount > capabilities.maxImages;
}
