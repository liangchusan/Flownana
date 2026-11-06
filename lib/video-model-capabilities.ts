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
  if (option.family === "kling") return inputs.some(input => input.kind === "video") ? "Multimodal reference to video" : "Image reference to video";
  if (option.family === "gemini" || option.family === "grok") return "Image reference to video";
  if (inputs.some(input => input.kind !== "image") || images > 2) return "Multimodal reference to video";
  return images === 2 ? "First and last frame to video" : "Image to video";
}

// Tags are numbered within each media type, in the same order as the provider arrays.
export function videoReferenceLabels(inputs: Array<{ kind: string }>) {
  const counts: Record<string, number> = {};
  return inputs.map(input => `@${input.kind}_${counts[input.kind] = (counts[input.kind] ?? 0) + 1}`);
}

export function videoReferencePromptIssue(modelName: string, prompt: string, inputs: Array<{ kind: string }>) {
  if (modelName !== "Kling 4.0") return undefined;
  const labels = videoReferenceLabels(inputs).filter(label => /^@(image|video)_/.test(label));
  for (const match of prompt.matchAll(/@/g)) {
    const rest = prompt.slice(match.index);
    if (!labels.some(label => rest.startsWith(label) && !/[A-Za-z0-9_]/.test(rest[label.length] ?? ""))) {
      return "Each @ reference must match an attached @image_N or @video_N. Check the numbered references before generating.";
    }
  }
  return undefined;
}
