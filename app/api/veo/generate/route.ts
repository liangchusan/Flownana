import { matchesRequestAccount } from "@/lib/account-scope";
import { authOptions } from "@/lib/auth-options";
import {
  ProviderGenerationError
} from "@/lib/generation-errors";
import { getVideoInputCapabilities } from "@/lib/generation-input-capabilities";
import {
  attachGenerationTask,
  failGeneration,
  recoverGenerationObligations, reserveGeneration
} from "@/lib/generation-lifecycle";
import {
  DEFAULT_VIDEO_ASPECT_RATIOS,
  formatVideoResolution,
  getVideoModelName,
  VIDEO_MODEL_OPTIONS
} from "@/lib/generation-pricing";
import { generationErrorResponse, generationResponse, generationUncertainResponse } from "@/lib/generation-response";
import {
  enforceInputMediaSize,
  persistOrReuseMediaInput,
} from "@/lib/media-assets";
import type { VideoReferenceInput } from "@/lib/video-reference-input";
import { Prisma, type Generation } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { createVideoTask, resolveVideoOption, settleVideoTask, videoErrorResponse } from "@/lib/video-generation-service";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ success: true, options: VIDEO_MODEL_OPTIONS });
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !matchesRequestAccount(request, session.user)) return videoErrorResponse("auth_required");
    // Never let a query parameter choose the endpoint for an already-paid task.
    return await settleVideoTask(session.user, taskId);
  } catch (error) {
    console.error("Video status could not be confirmed:", error);
    return generationUncertainResponse({ taskId });
  }
}

export async function POST(request: NextRequest) {
  let account: { id: string; accountCreatedAt: string } | undefined;
  let reserved: Generation | undefined;
  let reservationAttempted = false;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !matchesRequestAccount(request, session.user)) return videoErrorResponse("auth_required");
    account = session.user;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return videoErrorResponse("invalid_parameters");
    const { prompt, imageUrls, inputs, modelOptionId, model, aspectRatio, watermark, runId, generateAudio } = body;
    if (typeof prompt !== "string" || !prompt.trim()) return videoErrorResponse("prompt_required");
    if ((modelOptionId != null && typeof modelOptionId !== "string") ||
      (model != null && typeof model !== "string") ||
      (aspectRatio != null && typeof aspectRatio !== "string") ||
      (generateAudio != null && typeof generateAudio !== "boolean") ||
      (watermark != null && typeof watermark !== "string")) return videoErrorResponse("invalid_parameters");
    const option = resolveVideoOption({ modelOptionId, model });
    if (!option) return videoErrorResponse("invalid_parameters");
    const ratio = aspectRatio || option.aspectRatios?.[0] || "Auto";
    if (!(option.aspectRatios || DEFAULT_VIDEO_ASPECT_RATIOS).includes(ratio)) return videoErrorResponse("invalid_parameters");
    if (inputs != null && (!Array.isArray(inputs) || inputs.some((input) =>
      !input || typeof input.url !== "string" || !input.url.trim() || !["image", "video", "audio"].includes(input.kind)
    ))) return videoErrorResponse("invalid_parameters");
    if (imageUrls != null && (!Array.isArray(imageUrls) || imageUrls.some((url) => typeof url !== "string" || !url.trim()))) {
      return videoErrorResponse("invalid_parameters");
    }
    const requestedInputs: VideoReferenceInput[] = inputs ??
      (imageUrls || []).map((url: string) => ({ url, kind: "image" as const }));
    const capabilities = getVideoInputCapabilities(getVideoModelName(option));
    const counts = requestedInputs.reduce((sum, input) => ({ ...sum, [input.kind]: sum[input.kind] + 1 }),
      { image: 0, video: 0, audio: 0 });
    if (counts.image > capabilities.maxImages || counts.video > capabilities.maxVideos || counts.audio > capabilities.maxAudios ||
      (option.family === "wan" && counts.video > 0 && option.duration > 15)) return videoErrorResponse("invalid_parameters");
    if (option.requiresImageInput && !counts.image) return videoErrorResponse("input_image_required");
    const inputMedia = await Promise.all(requestedInputs.map(async (input, index) =>
      enforceInputMediaSize(await persistOrReuseMediaInput({
        source: input.url.trim(), userId: account!.id, requestId: `${crypto.randomUUID()}-${index}`, kind: input.kind,
      }), input.kind === "image" ? capabilities.maxImageBytes : input.kind === "video" ? capabilities.maxVideoBytes : capabilities.maxAudioBytes, input.kind)
    ));
    const normalizedInputs = requestedInputs.map((input, index) => ({ ...input, url: inputMedia[index].url }));
    const normalizedImageUrls = normalizedInputs.filter((input) => input.kind === "image").map((input) => input.url);
    const parameters: Prisma.InputJsonObject = {
      model: getVideoModelName(option), provider: option.provider,
      resolution: formatVideoResolution(option.resolution), aspectRatio: ratio, duration: option.duration,
      audio: option.hasAudio && generateAudio !== false ? "On" : "Off",
      inputKinds: normalizedInputs.map((input) => input.kind),
      mode: counts.video || counts.audio || counts.image > 2 ? "Multimodal reference to video"
        : counts.image === 2 ? "First and last frame to video" : counts.image === 1 ? "Image to video" : "Text to video",
      ...(typeof runId === "string" && runId.trim() ? { runId: runId.trim().slice(0, 120), outputIndex: 0, outputCount: 1 } : {}),
    };
    await recoverGenerationObligations(account);
    reservationAttempted = true;
    reserved = await reserveGeneration({ account, type: "video", prompt: prompt.trim(), modelOptionId: option.id,
      creditsCost: option.credits, parameters,
      inputs: inputMedia.map((media, position) => ({ media, position, role: "input",
        type: requestedInputs[position].kind === "audio" ? "music" : requestedInputs[position].kind as "image" | "video" })),
    });
    const taskId = await createVideoTask({ prompt: prompt.trim(), imageUrls: normalizedImageUrls,
      inputs: normalizedInputs, aspectRatio: ratio, generateAudio, watermark, option });
    reserved = await attachGenerationTask(account, reserved.id, taskId);
    return generationResponse(reserved);
  } catch (error) {
    console.error("Error generating video:", error);
    if (reserved && account) {
      try {
        return generationResponse((await failGeneration({ account, id: reserved.id, error,
          source: error instanceof ProviderGenerationError ? "provider" : "app" })).generation);
      } catch (settlementError) {
        console.error("Video failure remains recoverable:", settlementError);
        return generationUncertainResponse({
          taskId: reserved.taskId || reserved.id, generationId: reserved.id,
        });
      }
    }
    return generationErrorResponse(error, "video", {}, reservationAttempted);
  }
}
