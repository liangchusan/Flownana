import { canonicalVideoModelName, type VideoModelOption } from "./generation-pricing.ts";

export function getVideoPromptLimits(modelName: string) {
  return {
    min: modelName === "Seedance 2.0 Mini" ? 3 : 1,
    max: modelName === "Grok Imagine Video 1.5" ? 4096 : 5000,
  };
}

export function videoPromptIssue(modelName: string, prompt: string) {
  const { min, max } = getVideoPromptLimits(canonicalVideoModelName(modelName));
  const length = prompt.trim().length;
  return length < min || length > max ? `Use ${min}–${max} characters for this video model.` : undefined;
}

export function videoInputMode(option: VideoModelOption, inputs: Array<{ kind: string }>) {
  const images = inputs.filter(input => input.kind === "image").length;
  if (!inputs.length) return "Text to video";
  if (option.family === "gemini" || option.family === "grok") return "Image reference to video";
  if (inputs.some(input => input.kind !== "image") || images > 2) return "Multimodal reference to video";
  return images === 2 ? "First and last frame to video" : "Image to video";
}
