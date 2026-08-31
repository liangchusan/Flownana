import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Generation } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { matchesRequestAccount } from "@/lib/account-scope";
import { getKieApiKey } from "@/lib/kie";
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

const KIE_API_BASE = "https://api.kie.ai";
const DEFAULT_IMAGE_MODEL_ID: ImageModelOptionId = "gpt-image-2";
type PersistedGenerationParameters = Record<string, string | number>;
const IMAGE_ASPECT_RATIOS = new Set([
  "auto",
  "9:16",
  "16:9",
  "1:1",
  "3:4",
  "4:3",
]);

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

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidImageAspectRatio(params: {
  modelId: ImageModelOptionId;
  resolution: ImageResolutionKey;
  aspectRatio: string;
}) {
  if (!IMAGE_ASPECT_RATIOS.has(params.aspectRatio)) {
    return false;
  }

  if (params.modelId === "gpt-image-2") {
    if (params.aspectRatio === "auto") {
      return params.resolution === "1K";
    }
    if (params.resolution === "4K" && params.aspectRatio === "1:1") {
      return false;
    }
  }

  if (params.modelId === "qwen-image-3-pro" && params.aspectRatio === "auto") {
    return false;
  }

  return true;
}

async function createImageTask(params: {
  modelId: ImageModelOptionId;
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  outputFormat?: "png" | "jpg" | "jpeg";
  inputUrls?: string[];
}) {
  const apiKey = getKieApiKey();

  if (!apiKey) {
    throw new Error(
      "KIE_API_KEY environment variable is not configured. Please add it to .env and try again."
    );
  }

  const fmt =
    params.outputFormat === "jpeg" || params.outputFormat === "jpg"
      ? "jpg"
      : "png";

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    output_format: fmt,
  };

  if (params.modelId === "qwen-image-3-pro") {
    input.image_size = params.aspectRatio?.trim() || "1:1";
    input.resolution = params.resolution?.trim() || "1K";
  } else {
    input.aspect_ratio = params.aspectRatio?.trim() || "1:1";
    input.resolution = params.resolution?.trim() || "1K";
  }

  if (params.inputUrls?.length) {
    if (params.modelId === "nano-banana-2") {
      input.image_input = params.inputUrls;
    } else if (params.modelId === "qwen-image-3-pro") {
      input.image_urls = params.inputUrls;
    } else {
      input.input_urls = params.inputUrls;
    }
  }

  const modelOption = IMAGE_MODEL_OPTION_MAP[params.modelId];
  const providerModel = params.inputUrls?.length
    ? modelOption.imageToImageModel
    : modelOption.textToImageModel;
  const body = {
    model: providerModel,
    input,
  };

  const res = await fetch(`${KIE_API_BASE}/api/v1/jobs/createTask`, {
    signal: AbortSignal.timeout(30_000),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`${modelOption.label} createTask returned error:`, text);
    throw new ProviderGenerationError(text || res.statusText, res.status);
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: { taskId?: string };
  };

  if (json.code !== 200 || !json.data?.taskId) {
    console.error(`${modelOption.label} createTask response error:`, json);
    throw new ProviderGenerationError(
      json.msg || "Failed to create generation task. Please try again later."
    );
  }

  return json.data.taskId;
}

async function pollImageResult(taskId: string, modelLabel: string, deadline: number) {
  const apiKey = getKieApiKey();

  if (!apiKey) {
    throw new Error(
      "KIE_API_KEY environment variable is not configured. Please add it to .env and try again."
    );
  }

  const intervalMs = 2_000; // 每 2 秒轮询一次

  while (Date.now() < deadline) {
    const res = await fetch(
      `${KIE_API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(
        taskId
      )}`,
      {
        signal: AbortSignal.timeout(Math.max(1, Math.min(10_000, deadline - Date.now()))),
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`${modelLabel} recordInfo returned error:`, text);
      throw new ProviderGenerationError(text || res.statusText, res.status);
    }

    const json = (await res.json()) as {
      code: number;
      msg: string;
      data?: {
        state?: "waiting" | "success" | "fail";
        resultJson?: string | null;
        failMsg?: string | null;
      };
    };

    if (json.code !== 200 || !json.data) {
      console.error(`${modelLabel} recordInfo response error:`, json);
      throw new ProviderGenerationError(
        json.msg || "Failed to query task status. Please try again later."
      );
    }

    const state = json.data.state;

    if (state === "waiting") {
      await sleep(intervalMs);
      continue;
    }

    if (state === "fail") {
      console.error(`${modelLabel} task failed:`, json.data.failMsg);
      throw new ProviderGenerationError(
        json.data.failMsg || "Generation failed. Please try again later."
      );
    }

    if (state === "success") {
      if (!json.data.resultJson) {
        throw new Error(
          "Task succeeded but did not return results. Please try again later."
        );
      }

      // resultJson 是一个 JSON 字符串，例如：
      // {"resultUrls":["https://...png"]}
      let parsed: unknown;
      try {
        parsed = JSON.parse(json.data.resultJson);
      } catch (e) {
        console.error("Error parsing resultJson:", e, json.data.resultJson);
        throw new Error(
          "Failed to parse generation results. Please try again later."
        );
      }

      const result = parsed as { resultUrls?: string[] };
      const imageUrl = result.resultUrls?.[0];

      if (!imageUrl) {
        throw new Error(
          "Generated image URL not found. Please try again later."
        );
      }

      return imageUrl;
    }

    // 非预期状态，等待一会儿再试
    await sleep(intervalMs);
  }

  throw new Error("Generation timeout. Please try again later.");
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
    if ((model != null && (typeof model !== "string" || !Object.hasOwn(IMAGE_MODEL_OPTION_MAP, model))) ||
      (resolution != null && typeof resolution !== "string") ||
      (aspectRatio != null && typeof aspectRatio !== "string")) return imageErrorResponse("invalid_parameters");
    const modelId = (model ?? DEFAULT_IMAGE_MODEL_ID) as ImageModelOptionId;
    const modelOption = IMAGE_MODEL_OPTION_MAP[modelId];
    const res = (resolution?.trim() || "1K").toUpperCase() as ImageResolutionKey;
    const ar = aspectRatio?.trim().toLowerCase() || "1:1";
    const cost = getImageGenerationCredits(modelId, res);
    if (!cost || !isValidImageAspectRatio({ modelId, resolution: res, aspectRatio: ar })) {
      return imageErrorResponse("invalid_parameters");
    }
    const sources = imageUrls ?? (imageUrl ? [imageUrl] : []);
    if (!Array.isArray(sources) || sources.some((source) => typeof source !== "string" || !source.trim())) {
      return imageErrorResponse("invalid_parameters");
    }
    const capabilities = getImageInputCapabilities(modelId);
    if (sources.length > capabilities.maxImages) return imageErrorResponse("invalid_parameters");
    const inputMedia = await Promise.all(sources.map(async (source: string, index: number) =>
      enforceInputMediaSize(await persistOrReuseImageInput({
        source: source.trim(), userId: account!.id, requestId: `${crypto.randomUUID()}-${index}`,
      }), capabilities.maxImageBytes, "image")
    ));
    const parameters: PersistedGenerationParameters = {
      model: modelOption.label, resolution: res, aspectRatio: ar,
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
      modelId, prompt: prompt.trim(), aspectRatio: ar, resolution: res, outputFormat: "png",
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
