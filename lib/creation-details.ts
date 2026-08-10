import type {
  CreationHistoryItem,
  GenerationParameters,
} from "./creation-history";
import { normalizeGenerationParameters } from "./creation-history";
import {
  IMAGE_MODEL_OPTIONS,
  VIDEO_MODEL_OPTION_MAP,
  formatVideoResolution,
  getVideoModelName,
} from "./generation-pricing";

function legacyModelName(creation: CreationHistoryItem): string | undefined {
  if (!creation.modelOptionId) return undefined;

  if (creation.type === "video") {
    const option = VIDEO_MODEL_OPTION_MAP[creation.modelOptionId];
    return option ? getVideoModelName(option) : undefined;
  }

  const option = IMAGE_MODEL_OPTIONS.find(
    (item) =>
      item.id === creation.modelOptionId ||
      item.textToImageModel === creation.modelOptionId ||
      item.imageToImageModel === creation.modelOptionId
  );
  return option?.label;
}

export function getCreationParameters(
  creation: CreationHistoryItem
): GenerationParameters | undefined {
  const saved = normalizeGenerationParameters(creation.parameters) || {};

  if (creation.type === "video" && creation.modelOptionId) {
    const option = VIDEO_MODEL_OPTION_MAP[creation.modelOptionId];
    if (option) {
      return {
        model: saved.model || getVideoModelName(option),
        resolution: saved.resolution || formatVideoResolution(option.resolution),
        aspectRatio: saved.aspectRatio,
        duration: saved.duration ?? option.duration,
        audio: saved.audio || (option.hasAudio ? "On" : "Off"),
        mode: saved.mode,
      };
    }
  }

  const model = saved.model || legacyModelName(creation);
  const parameters = { ...saved, model };
  return Object.values(parameters).some((item) => item !== undefined)
    ? parameters
    : undefined;
}
