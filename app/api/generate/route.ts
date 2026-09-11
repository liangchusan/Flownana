import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Generation } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { matchesRequestAccount } from "@/lib/account-scope";
import { createImageTask, pollImageResult } from "@/lib/image-generation-provider";
import {
  attachGenerationTask, completeGeneration, failGeneration, GenerationRequestError,
  claimGenerationOutput, recordGenerationOutputPath, finishGenerationOutputAttempt,
  isActiveGeneration, recoverGenerationObligations, reserveGeneration,
} from "@/lib/generation-lifecycle";
import { generationErrorResponse, generationResponse, generationUncertainResponse } from "@/lib/generation-response";
import {
  IMAGE_MODEL_OPTION_MAP,
  getImageGenerationCredits,
  type ImageModelOptionId,
  type ImageResolutionKey,
} from "@/lib/generation-pricing";
import { getImageInputCapabilities } from "@/lib/generation-input-capabilities";
import {
  ProviderGenerationError,
  getGenerationErrorHttpStatus,
  getGenerationErrorPayload,
  type GenerationErrorCode,
} from "@/lib/generation-errors";
import { persistGeneratedMedia } from "@/lib/media-storage";
import {
  persistOrReuseImageInput,
  enforceInputMediaSize,
} from "@/lib/media-assets";

import { getImageAspectRatios, getImagePromptMinLength, IMAGE_PROMPT_MAX_LENGTH, isSupportedImageInputType } from "@/lib/image-model-capabilities";

const DEFAULT_IMAGE_MODEL_ID: ImageModelOptionId = "gpt-image-2";
type PersistedGenerationParameters = Record<string, string | number>;
export const maxDuration = 300;

function imageErrorResponse(
  code: GenerationErrorCode,
  status?: number,
  overrides?: { message?: string; required?: number; available?: number }
) {
  const payload = getGenerationErrorPayload(
    {
      errorCode: code,
      ...(overrides?.message ? { error: overrides.message } : {}),
    },
    { mediaType: "image" }
  );
  return NextResponse.json(
    {
      ...payload,
      ...(overrides?.required !== undefined ? { required: overrides.required } : {}),
      ...(overrides?.available !== undefined ? { available: overrides.available } : {}),
    },
    { status: status ?? getGenerationErrorHttpStatus(code) }
  );
}

export async function POST(request: NextRequest) {
  const deadline = Date.now() + 190_000; // Leave time for safe media storage and settlement.
  let account: { id: string; accountCreatedAt: string } | undefined;
  let reserved: Generation | undefined;
  let reservationAttempted = false;
  let outputAttemptId: string | null = null;
  let outputUploadAcknowledged = false;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !matchesRequestAccount(request, session.user)) return imageErrorResponse("auth_required");
    account = session.user;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return imageErrorResponse("invalid_parameters");
    const { prompt, imageUrl, imageUrls, model, resolution, aspectRatio, runId, outputIndex, outputCount } = body;
    if (typeof prompt !== "string" || !prompt.trim()) return imageErrorResponse("prompt_required");
    if (prompt.trim().length > IMAGE_PROMPT_MAX_LENGTH) return imageErrorResponse("invalid_parameters");
    if ((model != null && (typeof model !== "string" || !Object.hasOwn(IMAGE_MODEL_OPTION_MAP, model))) ||
      (resolution != null && typeof resolution !== "string") ||
      (aspectRatio != null && typeof aspectRatio !== "string")) return imageErrorResponse("invalid_parameters");
    const modelId = (model ?? DEFAULT_IMAGE_MODEL_ID) as ImageModelOptionId;
    if (prompt.trim().length < getImagePromptMinLength(modelId)) return imageErrorResponse("invalid_parameters");
    const modelOption = IMAGE_MODEL_OPTION_MAP[modelId];
    const hasResolution = modelOption.resolutions?.length !== 0;
    if (!hasResolution && resolution != null) return imageErrorResponse("invalid_parameters");
    const res = (resolution?.trim() || "1K").toUpperCase() as ImageResolutionKey;
    const ar = aspectRatio?.trim().toLowerCase() || "1:1";
    if (hasResolution && !(modelOption.resolutions ?? ["1K", "2K", "4K"]).includes(res)) {
      return imageErrorResponse("invalid_parameters");
    }
    const sources = imageUrls ?? (imageUrl ? [imageUrl] : []);
    if (!Array.isArray(sources) || sources.some((source) => typeof source !== "string" || !source.trim())) {
      return imageErrorResponse("invalid_parameters");
    }
    if (!getImageAspectRatios(modelId, res, sources.length).includes(ar)) return imageErrorResponse("invalid_parameters");
    const capabilities = getImageInputCapabilities(modelId);
    if (sources.length > capabilities.maxImages) return imageErrorResponse("invalid_parameters");
    const cost = getImageGenerationCredits(modelId, res, sources.length);
    if (!cost) return imageErrorResponse("provider_unavailable");
    const inputMedia = await Promise.all(sources.map(async (source: string, index: number) =>
      enforceInputMediaSize(await persistOrReuseImageInput({
        source: source.trim(), userId: account!.id, requestId: `${crypto.randomUUID()}-${index}`,
      }), capabilities.maxImageBytes, "image")
    ));
    if (inputMedia.some(media => !isSupportedImageInputType(modelId, media.contentType))) return imageErrorResponse("unsupported_file_type");
    const parameters: PersistedGenerationParameters = {
      model: modelOption.label, ...(hasResolution ? { resolution: res } : {}), aspectRatio: ar,
      mode: inputMedia.length ? "Image to image" : "Text to image",
      ...(typeof runId === "string" && runId.trim() ? { runId: runId.trim().slice(0, 120) } : {}),
      ...(Number.isInteger(outputIndex) && outputIndex >= 0 && outputIndex < 4 ? { outputIndex } : {}),
      ...(Number.isInteger(outputCount) && outputCount >= 1 && outputCount <= 4 ? { outputCount } : {}),
    };
    await recoverGenerationObligations(account);
    reservationAttempted = true;
    reserved = await reserveGeneration({
      account, type: "image", prompt: prompt.trim(), creditsCost: cost, parameters,
      modelOptionId: inputMedia.length ? modelOption.imageToImageModel : modelOption.textToImageModel,
      inputs: inputMedia.map((media, position) => ({ media, position, type: "image", role: "input" })),
    });
    if (Date.now() >= deadline) throw new GenerationRequestError("timeout");
    const taskId = await createImageTask({
      modelId, prompt: prompt.trim(), aspectRatio: ar, resolution: hasResolution ? res : undefined,
      inputUrls: inputMedia.map((media) => media.url),
    });
    reserved = await attachGenerationTask(account, reserved.id, taskId);
    if (!isActiveGeneration(reserved.status)) return generationResponse(reserved);
    const providerImageUrl = await pollImageResult(taskId, modelOption.label, deadline);
    const claimed = await claimGenerationOutput(account, reserved.id);
    outputAttemptId = claimed.attemptId;
    if (!outputAttemptId) return generationResponse(claimed.generation);
    const output = await persistGeneratedMedia({ sourceUrl: providerImageUrl, userId: account.id, taskId, kind: "image",
      beforeUpload: (pathname) => recordGenerationOutputPath(account!, reserved!.id, outputAttemptId!, pathname),
    });
    outputUploadAcknowledged = true;
    const result = await completeGeneration({ account, id: reserved.id, attemptId: outputAttemptId,
      output: { media: output, role: "output", type: "image", position: 0 },
    });
    return generationResponse(result.generation);
  } catch (error) {
    console.error("Error generating image:", error);
    if (reserved && account) {
      try {
        const settled = await failGeneration({ account, id: reserved.id, error,
          ...(outputAttemptId ? { attemptId: outputAttemptId } : {}),
          source: error instanceof ProviderGenerationError ? "provider" : "app" });
        return generationResponse(settled.generation);
      } catch (settlementError) {
        console.error("Image failure remains recoverable:", settlementError);
        return generationUncertainResponse({
          taskId: reserved.taskId || reserved.id, generationId: reserved.id,
        });
      }
    }
    return generationErrorResponse(error, "image", {}, reservationAttempted);
  } finally {
    if (account && reserved && outputAttemptId) await finishGenerationOutputAttempt(account, reserved.id, outputAttemptId, outputUploadAcknowledged);
  }
}
