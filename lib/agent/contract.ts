import { z } from "zod";
import { IMAGE_MODEL_OPTION_MAP, IMAGE_MODEL_OPTIONS, VIDEO_MODEL_OPTIONS, getImageGenerationCredits, getVideoModelName, type ImageModelOptionId, type ImageResolutionKey } from "../generation-pricing.ts";
import { getImageInputCapabilities, getVideoInputCapabilities } from "../generation-input-capabilities.ts";
import { getImageAspectRatios, isSupportedImageInputType } from "../image-model-capabilities.ts";

export class AgentError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "invalid_request", status = 400) { super(message); this.code = code; this.status = status; }
}
export const agentInputSchema = z.object({
  url: z.string().url().max(2048), kind: z.enum(["image", "video", "audio"]),
  role: z.enum(["subject", "style", "layout", "brand", "edit", "reference"]).default("reference"),
});
export type AgentInput = z.infer<typeof agentInputSchema>;
export const messageSchema = z.object({
  conversationId: z.string().uuid(), id: z.string().uuid(), revision: z.number().int().min(0),
  prompt: z.string().trim().min(1).max(5000), inputs: z.array(agentInputSchema).max(22).default([]),
  templateId: z.string().max(80).optional(), sourceGenerationId: z.string().max(128).optional(),
});
export const proposalSchema = z.object({
  type: z.enum(["image", "video"]), summary: z.string().min(1).max(1000),
  prompt: z.string().min(3).max(4500), exactText: z.array(z.string().max(500)).max(20),
  selectedOutputId: z.string().max(128).optional(),
  model: z.string().max(100).optional(), resolution: z.string().max(10).optional(),
  aspectRatio: z.string().max(10).optional(), count: z.number().int().min(1).max(4).optional(),
  duration: z.number().int().min(1).max(30).optional(), sound: z.boolean().optional(),
  directions: z.array(z.object({ title: z.string().min(1).max(100), prompt: z.string().min(1).max(350) })).max(4),
});
export type AgentProposal = z.infer<typeof proposalSchema>;
export type AgentQuote = AgentProposal & {
  model: string; modelId: string; resolution: string; aspectRatio: string; count: number;
  credits: number; unitCredits: number; inputs: AgentInput[]; templateId?: string; templateVersion?: number;
};
export function usageDay(now = new Date()) { return now.toISOString().slice(0, 10); }
export function quotaLimit(paid: boolean) { return paid ? 100 : 10; }
export function resetTime(now = new Date()) { return new Date(`${usageDay(new Date(now.getTime() + 86400000))}T00:00:00.000Z`).toISOString(); }
export function modelCatalog() {
  return {
    images: IMAGE_MODEL_OPTIONS.map(m => ({ id: m.id, name: m.label, resolutions: m.resolutions ?? Object.keys(m.credits), ...getImageInputCapabilities(m.id) })),
    videos: [...new Set(VIDEO_MODEL_OPTIONS.map(getVideoModelName))].map(name => {
      const options = VIDEO_MODEL_OPTIONS.filter(m => getVideoModelName(m) === name);
      return { name, ...getVideoInputCapabilities(name), resolutions: [...new Set(options.map(m => m.resolution))], durations: [...new Set(options.map(m => m.duration))] };
    }),
  };
}
export function buildQuote(value: unknown, inputs: AgentInput[], context: {
  templateId?: string; templateVersion?: number; editing?: boolean; userText: string; maxVideoResolution?: string;
}): AgentQuote {
  const p = proposalSchema.parse(value);
  if (p.exactText.some(text => !context.userText.includes(text))) throw new AgentError("Use the user's exact wording. Ask for missing text instead of inventing it.");
  const counts = { image: 0, video: 0, audio: 0 };
  inputs.forEach(input => counts[input.kind]++);
  const base = { ...p, inputs, ...(context.templateId ? { templateId: context.templateId, templateVersion: context.templateVersion } : {}) };
  if (p.type === "image") {
    const modelId = (p.model ? IMAGE_MODEL_OPTIONS.find(m => m.id === p.model || m.label === p.model)?.id : "gpt-image-2-5-flare") as ImageModelOptionId | undefined;
    if (!modelId) throw new AgentError("Choose an available image model.");
    const model = IMAGE_MODEL_OPTION_MAP[modelId];
    const caps = getImageInputCapabilities(modelId);
    if (counts.video || counts.audio || counts.image > caps.maxImages) throw new AgentError("These references do not fit this image model. Ask the user to update them.");
    const resolution = p.resolution ?? (model.flatCredits ? "Auto" : "1K");
    if (!model.flatCredits && !(model.resolutions ?? Object.keys(model.credits)).includes(resolution as ImageResolutionKey)) throw new AgentError("Choose a supported image resolution.");
    if (model.flatCredits && resolution !== "Auto") throw new AgentError("This model does not offer a resolution setting.");
    const aspectRatio = p.aspectRatio ?? "1:1";
    if (!getImageAspectRatios(modelId, resolution as ImageResolutionKey, counts.image).includes(aspectRatio)) throw new AgentError("Choose a supported image ratio.");
    const count = p.count ?? (context.editing ? 1 : context.templateId ? 4 : 1);
    if (p.directions.length !== count) throw new AgentError(`Provide exactly ${count} directions, preserving the selected direction when editing.`);
    const unitCredits = getImageGenerationCredits(modelId, resolution as ImageResolutionKey, counts.image);
    if (!unitCredits) throw new AgentError("This image quote is unavailable.");
    return { ...base, model: model.label, modelId, resolution, aspectRatio, count, unitCredits, credits: unitCredits * count };
  }
  if (p.count && p.count !== 1) throw new AgentError("Video requests create one output at a time.");
  const name = p.model ?? "Seedance 2.0 Mini";
  const resolution = p.resolution ?? "720P", duration = p.duration ?? 5, sound = p.sound ?? false;
  const options = VIDEO_MODEL_OPTIONS.filter(m => (getVideoModelName(m) === name || m.id === name) && m.resolution === resolution && m.duration === duration);
  const option = options.sort((a, b) => a.credits - b.credits)[0];
  if (!option) throw new AgentError("This video model does not support those settings. Offer a supported alternative.");
  const caps = getVideoInputCapabilities(getVideoModelName(option));
  if (counts.image > caps.maxImages || counts.video > caps.maxVideos || counts.audio > caps.maxAudios || (caps.imageRequired && !counts.image) || (option.family === "wan" && counts.video > 0 && duration > 15)) throw new AgentError("The references do not fit this video model. Ask for compatible inputs.");
  const rank: Record<string, number> = { "480P": 0, "720P": 1, "1080P": 2, "2K": 3, "4K": 4 };
  if (rank[resolution] > rank[context.maxVideoResolution ?? "720P"]) throw new AgentError("This resolution is above the account's video allowance. Ask the user to choose an allowed resolution.");
  if ((sound && !option.hasAudio) || (!sound && option.hasAudio && !option.audioConfigurable)) throw new AgentError("This model does not support the requested sound setting.");
  const aspectRatio = p.aspectRatio ?? "16:9";
  if (!(option.aspectRatios ?? ["Auto", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]).includes(aspectRatio as never)) throw new AgentError("Choose a supported video ratio.");
  return { ...base, model: getVideoModelName(option), modelId: option.id, resolution, aspectRatio, duration, sound, count: 1, unitCredits: option.credits, credits: option.credits };
}
export function validateInputMetadata(quote: AgentQuote, media: Array<{ type: string; sizeBytes: number | null; contentType: string | null }>) {
  const caps = quote.type === "image" ? getImageInputCapabilities(quote.modelId as ImageModelOptionId) : getVideoInputCapabilities(quote.model);
  for (const asset of media) {
    const max = asset.type === "image" ? caps.maxImageBytes : asset.type === "video" ? caps.maxVideoBytes : caps.maxAudioBytes;
    if (!asset.sizeBytes || asset.sizeBytes > max) throw new AgentError("A reference exceeds this model's size limit.");
    if (quote.type === "image" && !isSupportedImageInputType(quote.modelId as ImageModelOptionId, asset.contentType)) throw new AgentError("A reference format is unsupported by this image model.");
  }
}
