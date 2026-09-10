import type { ImageModelOptionId, ImageResolutionKey } from "./generation-pricing";

export const IMAGE_PROMPT_MAX_LENGTH = 5000;
export function getImagePromptMinLength(model: ImageModelOptionId) {
  return model === "seedream-5-pro" ? 3 : 1;
}

const STANDARD_RATIOS = ["9:16", "16:9", "1:1", "3:4", "4:3"];

export function getImageAspectRatios(model: ImageModelOptionId, resolution: ImageResolutionKey, imageCount: number): string[] {
  if (model === "gpt-image-2-5-flare" || model === "gpt-image-2-5-sunburst") {
    return ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9", ...(resolution === "1K" ? ["27:16", "16:27", "9:8", "8:9"] : [])];
  }
  if (model === "grok-imagine-image-2-0") {
    return [...(imageCount > 0 ? ["auto"] : []), "1:1", "2:3", "3:2", "16:9", "9:16"];
  }
  if (model === "seedream-5-pro") return ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"];
  if (model === "qwen-image-3-pro") return [...STANDARD_RATIOS];
  // Keep the approved conservative GPT restrictions until live provider validation.
  if (model === "gpt-image-2") return [...(resolution === "1K" ? ["auto"] : []), ...STANDARD_RATIOS.filter(ratio => resolution !== "4K" || ratio !== "1:1")];
  return ["auto", ...STANDARD_RATIOS];
}

export function isSupportedImageInputType(model: ImageModelOptionId, contentType?: string | null): boolean {
  const type = contentType?.split(";")[0].trim().toLowerCase();
  return !!type && getImageInputTypes(model).includes(type);
}

export function getImageInputTypes(model: ImageModelOptionId): string[] {
  const types = ["image/jpeg", "image/png", "image/webp"];
  if (model === "qwen-image-3-pro") types.push("image/bmp", "image/gif", "image/tiff");
  return types;
}
