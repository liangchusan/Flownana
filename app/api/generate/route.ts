import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  CreditConsumptionConflictError,
  InsufficientCreditsError,
  consumeCreditsFIFO,
  refundConsumedCredits,
  type CreditConsumptionSnapshot,
} from "@/lib/credit-consumption";
import {
  IMAGE_MODEL_OPTION_MAP,
  getImageGenerationCredits,
  type ImageModelOptionId,
  type ImageResolutionKey,
} from "@/lib/generation-pricing";
import { getImageInputCapabilities } from "@/lib/generation-input-capabilities";
import {
  ProviderGenerationError,
  getGenerationErrorDisplay,
  getGenerationErrorHttpStatus,
  getGenerationErrorPayload,
  withGenerationCreditOutcome,
  type GenerationErrorCode,
} from "@/lib/generation-errors";
import { persistGeneratedMedia } from "@/lib/media-storage";
import type { StoredMedia } from "@/lib/media-storage";
import {
  persistOrReuseImageInput,
  syncGenerationMediaAssets,
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
  const apiKey = process.env.KIE_API_KEY || process.env.NANO_BANANA_API_KEY;

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

async function pollImageResult(taskId: string, modelLabel: string) {
  const apiKey = process.env.KIE_API_KEY || process.env.NANO_BANANA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "KIE_API_KEY environment variable is not configured. Please add it to .env and try again."
    );
  }

  const maxWaitMs = 300_000; // 最长等待 5 分钟
  const intervalMs = 2_000; // 每 2 秒轮询一次
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `${KIE_API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(
        taskId
      )}`,
      {
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
  const processingStartedAt = Date.now();
  let consumedCredits: CreditConsumptionSnapshot = [];
  let taskId: string | undefined;
  let userId: string | undefined;
  let promptForPersistence = "Untitled prompt";
  let parametersForPersistence: PersistedGenerationParameters | undefined;
  let inputUrlsForPersistence: string[] = [];
  let inputMediaForPersistence: StoredMedia[] = [];
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return imageErrorResponse("auth_required");
    }
    userId = session.user.id;

    const body = await request.json();
    const {
      prompt,
      imageUrl,
      imageUrls,
      model,
      resolution,
      aspectRatio,
      runId,
      outputIndex,
      outputCount,
    } = body as {
      prompt?: string;
      imageUrl?: string | null;
      imageUrls?: string[];
      mode?: "text-to-image" | "image-to-image";
      model?: string;
      resolution?: string;
      aspectRatio?: string;
      runId?: string;
      outputIndex?: number;
      outputCount?: number;
    };

    if (!prompt) {
      return imageErrorResponse("prompt_required");
    }
    promptForPersistence = prompt;

    const ar = aspectRatio && aspectRatio.trim() !== "" ? aspectRatio : "1:1";
    const res = (
      resolution && resolution.trim() !== "" ? resolution : "1K"
    ).toUpperCase() as ImageResolutionKey;
    const modelId = IMAGE_MODEL_OPTION_MAP[model as ImageModelOptionId]
      ? (model as ImageModelOptionId)
      : DEFAULT_IMAGE_MODEL_ID;
    const modelOption = IMAGE_MODEL_OPTION_MAP[modelId];
    const inputSources = (
      Array.isArray(imageUrls)
        ? imageUrls
        : imageUrl
          ? [imageUrl]
          : []
    ).filter((url): url is string => typeof url === "string" && url.trim().length > 0)
      .map((url) => url.trim());
    const inputCapabilities = getImageInputCapabilities(modelId);
    if (inputSources.length > inputCapabilities.maxImages) {
      return imageErrorResponse("invalid_parameters");
    }
    parametersForPersistence = {
      model: modelOption.label,
      resolution: res,
      aspectRatio: ar,
      mode: inputSources.length > 0 ? "Image to image" : "Text to image",
      ...(typeof runId === "string" && runId.trim().length > 0
        ? { runId: runId.trim().slice(0, 120) }
        : {}),
      ...(Number.isInteger(outputIndex) && Number(outputIndex) >= 0
        ? { outputIndex: Number(outputIndex) }
        : {}),
      ...(Number.isInteger(outputCount) && Number(outputCount) >= 1 && Number(outputCount) <= 4
        ? { outputCount: Number(outputCount) }
        : {}),
    };
    const cost = getImageGenerationCredits(modelId, res);
    if (!cost) {
      return imageErrorResponse("invalid_parameters");
    }

    if (
      !isValidImageAspectRatio({ modelId, resolution: res, aspectRatio: ar })
    ) {
      return imageErrorResponse("invalid_parameters");
    }

    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const inputMedia = inputSources.length > 0
      ? await Promise.all(
          inputSources.map((source, index) =>
            persistOrReuseImageInput({
              source,
              userId: session.user.id,
              requestId: `${requestId}-${index}`,
            })
          )
        )
      : undefined;
    const inputUrls = inputMedia?.map((media) => media.url);
    inputUrlsForPersistence = inputUrls || [];
    inputMediaForPersistence = inputMedia || [];

    consumedCredits = await consumeCreditsFIFO(session.user.id, cost);

    taskId = await createImageTask({
      modelId,
      prompt,
      aspectRatio: ar,
      resolution: res,
      outputFormat: "png",
      inputUrls,
    });

    const providerImageUrl = await pollImageResult(taskId, modelOption.label);
    const generatedImage = await persistGeneratedMedia({
      sourceUrl: providerImageUrl,
      userId: session.user.id,
      taskId,
      kind: "image",
    });
    const generatedImageUrl = generatedImage.url;
    parametersForPersistence = {
      ...parametersForPersistence,
      processingDurationMs: Date.now() - processingStartedAt,
    };

    const generation = await prisma.generation.upsert({
      where: { taskId },
      update: {
        type: "image",
        status: "success",
        urls: [generatedImageUrl],
        inputUrls: inputUrlsForPersistence,
        prompt,
        error: null,
        modelOptionId: inputUrls?.length
          ? modelOption.imageToImageModel
          : modelOption.textToImageModel,
        parameters: parametersForPersistence as Prisma.InputJsonValue,
        creditsCost: cost,
      },
      create: {
        userId,
        type: "image",
        status: "success",
        urls: [generatedImageUrl],
        inputUrls: inputUrlsForPersistence,
        prompt,
        taskId,
        modelOptionId: inputUrls?.length
          ? modelOption.imageToImageModel
          : modelOption.textToImageModel,
        parameters: parametersForPersistence as Prisma.InputJsonValue,
        creditsCost: cost,
      },
    });
    await syncGenerationMediaAssets({
      generationId: generation.id,
      userId,
      assets: [
        ...inputMediaForPersistence.map((media, position) => ({
          media,
          role: "input" as const,
          type: "image" as const,
          position,
        })),
        { media: generatedImage, role: "output", type: "image", position: 0 },
      ],
    });

    return NextResponse.json({
      success: true,
      imageUrl: generatedImageUrl,
      prompt,
      taskId,
      creditsCost: cost,
      parameters: parametersForPersistence,
      inputUrls: inputUrlsForPersistence,
    });
  } catch (error: any) {
    console.error("Error generating image:", error);
    if (parametersForPersistence) {
      parametersForPersistence = {
        ...parametersForPersistence,
        processingDurationMs: Date.now() - processingStartedAt,
      };
    }
    let creditsRefunded = false;
    let refundPending = false;
    if (consumedCredits.length > 0) {
      try {
        await refundConsumedCredits(consumedCredits);
        creditsRefunded = true;
      } catch (refundError) {
        refundPending = true;
        console.error("Failed to refund image credits:", refundError);
      }
    }

    let errorDisplay;
    if (error instanceof InsufficientCreditsError) {
      errorDisplay = getGenerationErrorDisplay(
        {
          errorCode: "insufficient_credits",
          error: `This generation needs ${error.required} credits, but you have ${error.available}.`,
        },
        { mediaType: "image" }
      );
    } else if (error instanceof CreditConsumptionConflictError) {
      errorDisplay = getGenerationErrorDisplay(
        { errorCode: "credit_conflict" },
        { mediaType: "image" }
      );
    } else {
      errorDisplay = getGenerationErrorDisplay(error, {
        mediaType: "image",
        source: error instanceof ProviderGenerationError ? "provider" : "app",
      });
    }
    errorDisplay = withGenerationCreditOutcome(errorDisplay, {
      creditsConsumed: consumedCredits.length > 0,
      creditsRefunded,
      refundPending,
    });

    if (taskId && userId) {
      try {
        const generation = await prisma.generation.upsert({
          where: { taskId },
          update: {
            type: "image",
            status: "failed",
            error: errorDisplay.message,
            inputUrls: inputUrlsForPersistence,
            ...(parametersForPersistence
              ? { parameters: parametersForPersistence as Prisma.InputJsonValue }
              : {}),
          },
          create: {
            userId,
            type: "image",
            status: "failed",
            urls: [],
            inputUrls: inputUrlsForPersistence,
            prompt: promptForPersistence,
            taskId,
            error: errorDisplay.message,
            ...(parametersForPersistence
              ? { parameters: parametersForPersistence as Prisma.InputJsonValue }
              : {}),
          },
        });
        await syncGenerationMediaAssets({
          generationId: generation.id,
          userId,
          assets: inputMediaForPersistence.map((media, position) => ({
            media,
            role: "input",
            type: "image",
            position,
          })),
        });
      } catch (persistErr) {
        console.error("Failed to persist image generation failure:", persistErr);
      }
    }

    const payload = getGenerationErrorPayload(
      {
        errorCode: errorDisplay.code,
        errorTitle: errorDisplay.title,
        error: errorDisplay.message,
        errorAction: errorDisplay.action,
        retryable: errorDisplay.retryable,
      },
      {
        mediaType: "image",
        creditsRefunded,
        refundPending,
      }
    );
    return NextResponse.json(
      {
        ...payload,
        ...(taskId ? { taskId } : {}),
        ...(error instanceof InsufficientCreditsError
          ? { required: error.required, available: error.available }
          : {}),
      },
      { status: getGenerationErrorHttpStatus(errorDisplay.code) }
    );
  }
}
