import type { VideoModelOption } from "./generation-pricing";

export type VideoReferenceInput = {
  url: string;
  kind: "image" | "video" | "audio";
};

export function buildVolcengineVideoTaskBody(params: {
  prompt: string;
  inputs: VideoReferenceInput[];
  aspectRatio?: string;
  generateAudio: boolean;
  option: VideoModelOption;
}) {
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: params.prompt },
    ...params.inputs.map((input) => ({
      type: `${input.kind}_url`,
      [`${input.kind}_url`]: { url: input.url },
      role: `reference_${input.kind}`,
    })),
  ];

  return {
    model: params.option.providerModel,
    content,
    generate_audio: params.generateAudio,
    ratio: params.aspectRatio && params.aspectRatio !== "Auto" ? params.aspectRatio : "adaptive",
    resolution: params.option.resolution.toLowerCase(),
    duration: params.option.duration,
    watermark: false,
  };
}

export function parseVolcengineVideoResult(value: unknown) {
  if (!value || typeof value !== "object") return { state: "pending" as const };
  const data = value as {
    status?: string;
    error?: { message?: string };
    content?: { video_url?: string };
  };
  if (data.status === "succeeded" && data.content?.video_url) {
    return { state: "success" as const, url: data.content.video_url };
  }
  if (["failed", "expired"].includes(data.status || "")) {
    return { state: "failed" as const, error: data.error?.message || "Video generation failed." };
  }
  return { state: "pending" as const };
}
