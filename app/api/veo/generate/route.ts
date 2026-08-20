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
  VIDEO_MODEL_OPTION_MAP,
  VIDEO_MODEL_OPTIONS,
  formatVideoResolution,
  getVideoModelName,
  type VideoModelOption,
  type VideoModelOptionId,
} from "@/lib/generation-pricing";
import {
  getKieVideoAspectRatio,
  getKieMarketVideoTaskBody,
} from "@/lib/kie-video-request";
import { parseKieVideoResult, type KieVideoResultData } from "@/lib/kie-video-result";
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
const VIDEO_TASK_TIMEOUT_MS = 45 * 60 * 1000;

function videoErrorResponse(
  code: GenerationErrorCode,
  status?: number,
  overrides?: { message?: string; required?: number; available?: number }
) {
  const payload = getGenerationErrorPayload(
    {
      errorCode: code,
      ...(overrides?.message ? { error: overrides.message } : {}),
    },
    { mediaType: "video" }
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

const FAMILY_ENDPOINTS: Record<
  VideoModelOption["family"],
  { create: string; detail: string; style: "veo" | "market" }
> = {
  veo: {
    create: "/api/v1/veo/generate",
    detail: "/api/v1/veo/record-info",
    style: "veo",
  },
  kling: {
    create: "/api/v1/jobs/createTask",
    detail: "/api/v1/jobs/recordInfo",
    style: "market",
  },
  seedance: {
    create: "/api/v1/jobs/createTask",
    detail: "/api/v1/jobs/recordInfo",
    style: "market",
  },
  happyhorse: {
    create: "/api/v1/jobs/createTask",
    detail: "/api/v1/jobs/recordInfo",
    style: "market",
  },
  grok: {
    create: "/api/v1/jobs/createTask",
    detail: "/api/v1/jobs/recordInfo",
    style: "market",
  },
  minimax: {
    create: "/api/v1/jobs/createTask",
    detail: "/api/v1/jobs/recordInfo",
    style: "market",
  },
};

function resolveVideoOption(params: {
  modelOptionId?: string;
  model?: string;
}): VideoModelOption | null {
  if (params.modelOptionId) {
    const byId = VIDEO_MODEL_OPTION_MAP[params.modelOptionId as VideoModelOptionId];
    if (byId) return byId;
    return null;
  }

  if (params.model) {
    return null;
  }

  return VIDEO_MODEL_OPTIONS[0] || null;
}

async function createVideoTask(params: {
  prompt: string;
  imageUrls?: string[];
  aspectRatio?: string;
  watermark?: string;
  option: VideoModelOption;
}) {
  const apiKey = process.env.KIE_API_KEY || process.env.NANO_BANANA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "KIE_API_KEY environment variable is not configured. Please add it to .env and try again."
    );
  }

  const endpoint = FAMILY_ENDPOINTS[params.option.family].create;
  const endpointStyle = FAMILY_ENDPOINTS[params.option.family].style;
  const hasImageInput = !!params.imageUrls?.length;
  const providerModel =
    hasImageInput && params.option.imageToVideoProviderModel
      ? params.option.imageToVideoProviderModel
      : params.option.providerModel;
  const aspectRatio = getKieVideoAspectRatio({
    aspectRatio: params.aspectRatio,
    hasImageInput,
  });
  let body: Record<string, unknown>;
  if (endpointStyle === "veo") {
    body = {
      prompt: params.prompt,
      imageUrls: params.imageUrls || [],
      model: providerModel,
      aspectRatio,
      duration: params.option.duration,
      watermark: params.watermark,
      enableTranslation: true,
      generationType:
          hasImageInput
          ? "REFERENCE_2_VIDEO"
          : "TEXT_2_VIDEO",
    };
  } else {
    body = getKieMarketVideoTaskBody({
      prompt: params.prompt,
      imageUrls: params.imageUrls,
      aspectRatio: params.aspectRatio,
      option: params.option,
    });
  }

  const res = await fetch(`${KIE_API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Video createTask returned error:", text);
    throw new ProviderGenerationError(text || res.statusText, res.status);
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: { taskId?: string };
  };

  if (json.code !== 200 || !json.data?.taskId) {
    console.error("Video createTask response error:", json);
    throw new ProviderGenerationError(
      json.msg || "Failed to create video generation task. Please try again later."
    );
  }

  return json.data.taskId;
}

function normalizeCreditConsumptionSnapshot(
  value: unknown
): CreditConsumptionSnapshot {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as { batchId?: unknown; amount?: unknown };
      if (typeof candidate.batchId !== "string") return null;
      if (typeof candidate.amount !== "number" || candidate.amount <= 0) {
        return null;
      }
      return {
        batchId: candidate.batchId,
        amount: candidate.amount,
      };
    })
    .filter((item): item is CreditConsumptionSnapshot[number] => !!item);
}

async function getVideoResultOnce(taskId: string, option: VideoModelOption) {
  const apiKey = process.env.KIE_API_KEY || process.env.NANO_BANANA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "KIE_API_KEY environment variable is not configured. Please add it to .env and try again."
    );
  }

  const endpoint = FAMILY_ENDPOINTS[option.family].detail;
  const detailUrl = `${KIE_API_BASE}${endpoint}?taskId=${encodeURIComponent(taskId)}`;
  let res: Response;
  try {
    res = await fetch(detailUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
  } catch (error) {
    console.error("Video details request failed:", error);
    return { state: "pending" as const };
  }

  if (!res.ok) {
    const text = await res.text();
    console.error("Video details returned error:", text);
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      return {
        state: "failed" as const,
        error: new ProviderGenerationError(text || res.statusText, res.status).message,
      };
    }
    return { state: "pending" as const };
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: KieVideoResultData;
  };

  if (json.code !== 200 || !json.data) {
    console.error("Video details response error:", json);
    return {
      state: "failed" as const,
      error: json.msg || "Failed to query task status. Please try again later.",
    };
  }

  return parseKieVideoResult(json.data);
}

function withProcessingDuration(parameters: unknown, createdAt: Date) {
  const current =
    parameters && typeof parameters === "object" && !Array.isArray(parameters)
      ? (parameters as Record<string, unknown>)
      : {};
  const savedDuration = current.processingDurationMs;
  if (
    typeof savedDuration === "number" &&
    Number.isFinite(savedDuration) &&
    savedDuration >= 0
  ) {
    return current;
  }
  return {
    ...current,
    processingDurationMs: Math.max(0, Date.now() - createdAt.getTime()),
  };
}

async function failVideoGeneration(params: {
  generation: {
    id: string;
    prompt: string;
    taskId: string | null;
    creditConsumption: unknown;
    createdAt: Date;
    parameters: unknown;
  };
  error: unknown;
  source: "app" | "provider";
}) {
  const consumedCredits = normalizeCreditConsumptionSnapshot(
    params.generation.creditConsumption
  );
  let creditsRefunded = false;
  let refundPending = false;

  if (consumedCredits.length > 0) {
    try {
      await refundConsumedCredits(consumedCredits);
      creditsRefunded = true;
    } catch (refundError) {
      refundPending = true;
      console.error("Failed to refund async video credits:", refundError);
    }
  }

  const display = withGenerationCreditOutcome(
    getGenerationErrorDisplay(params.error, {
      mediaType: "video",
      source: params.source,
    }),
    {
      creditsConsumed: consumedCredits.length > 0,
      creditsRefunded,
      refundPending,
    }
  );
  const settledParameters = withProcessingDuration(
    params.generation.parameters,
    params.generation.createdAt
  );

  await prisma.generation.update({
    where: { id: params.generation.id },
    data: {
      status: "failed",
      error: display.message,
      parameters: settledParameters as Prisma.InputJsonValue,
      ...(refundPending ? {} : { creditConsumption: Prisma.JsonNull }),
    },
  });

  const payload = getGenerationErrorPayload(
    {
      errorCode: display.code,
      errorTitle: display.title,
      error: display.message,
      errorAction: display.action,
      retryable: display.retryable,
    },
    {
      mediaType: "video",
      creditsRefunded,
      refundPending,
    }
  );

  return NextResponse.json(
    {
      success: false,
      pending: false,
      status: "failed",
      ...payload,
      prompt: params.generation.prompt,
      taskId: params.generation.taskId,
      parameters: settledParameters,
    },
    { status: getGenerationErrorHttpStatus(display.code) }
  );
}

async function settleVideoTask(params: {
  userId: string;
  taskId: string;
  option: VideoModelOption;
}) {
  const generation = await prisma.generation.findFirst({
    where: {
      taskId: params.taskId,
      userId: params.userId,
      type: "video",
    },
  });

  if (!generation) {
    return videoErrorResponse("task_not_found");
  }

  if (generation.status === "success") {
    return NextResponse.json({
      success: true,
      pending: false,
      status: generation.status,
      videoUrl: generation.urls[0],
      prompt: generation.prompt,
      taskId: generation.taskId,
      creditsCost: generation.creditsCost,
      modelOptionId: generation.modelOptionId,
      parameters: generation.parameters,
      inputUrls: generation.inputUrls,
    });
  }

  if (generation.status === "failed") {
    return failVideoGeneration({
      generation,
      error: generation.error || "Generation failed.",
      source: "app",
    });
  }

  const result = await getVideoResultOnce(params.taskId, params.option);
  if (result.state === "pending") {
    if (Date.now() - generation.createdAt.getTime() >= VIDEO_TASK_TIMEOUT_MS) {
      return failVideoGeneration({
        generation,
        error: { errorCode: "timeout" },
        source: "app",
      });
    }
    return NextResponse.json({
      success: true,
      pending: true,
      status: generation.status,
      prompt: generation.prompt,
      taskId: generation.taskId,
      creditsCost: generation.creditsCost,
      modelOptionId: generation.modelOptionId,
      parameters: generation.parameters,
      inputUrls: generation.inputUrls,
    });
  }

  if (result.state === "failed") {
    return failVideoGeneration({
      generation,
      error: result.error,
      source: "provider",
    });
  }

  let generatedVideo: StoredMedia;
  try {
    generatedVideo = await persistGeneratedMedia({
      sourceUrl: result.url,
      userId: params.userId,
      taskId: params.taskId,
      kind: "video",
    });
    await syncGenerationMediaAssets({
      generationId: generation.id,
      userId: params.userId,
      assets: [
        { media: generatedVideo, role: "output", type: "video", position: 0 },
      ],
    });
  } catch (error) {
    console.error("Failed to persist or register completed video:", error);
    return failVideoGeneration({
      generation,
      error: { errorCode: "media_processing_failed" },
      source: "app",
    });
  }
  const settledParameters = withProcessingDuration(
    generation.parameters,
    generation.createdAt
  );
  await prisma.generation.update({
    where: { id: generation.id },
    data: {
      status: "success",
      urls: [generatedVideo.url],
      error: null,
      parameters: settledParameters as Prisma.InputJsonValue,
      creditConsumption: Prisma.JsonNull,
    },
  });

  return NextResponse.json({
    success: true,
    pending: false,
    status: "success",
    videoUrl: generatedVideo.url,
    prompt: generation.prompt,
    taskId: generation.taskId,
    creditsCost: generation.creditsCost,
    modelOptionId: generation.modelOptionId,
    parameters: settledParameters,
    inputUrls: generation.inputUrls,
  });
}

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get("taskId");
  if (taskId) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return videoErrorResponse("auth_required");
    }

    const modelOptionId = request.nextUrl.searchParams.get("modelOptionId");
    const generation = await prisma.generation.findFirst({
      where: {
        taskId,
        userId: session.user.id,
        type: "video",
      },
      select: {
        modelOptionId: true,
      },
    });
    const option = resolveVideoOption({
      modelOptionId: modelOptionId || generation?.modelOptionId || undefined,
    });
    if (!option) {
      return videoErrorResponse("invalid_parameters");
    }

    return settleVideoTask({
      userId: session.user.id,
      taskId,
      option,
    });
  }

  return NextResponse.json({
    success: true,
    options: VIDEO_MODEL_OPTIONS,
  });
}

export async function POST(request: NextRequest) {
  const processingStartedAt = Date.now();
  let consumedCredits: CreditConsumptionSnapshot = [];
  let taskId: string | undefined;
  let userId: string | undefined;
  let promptForPersistence = "Untitled prompt";
  let parametersForPersistence: Record<string, string | number> | undefined;
  let inputUrlsForPersistence: string[] = [];
  let inputMediaForPersistence: StoredMedia[] = [];
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return videoErrorResponse("auth_required");
    }
    userId = session.user.id;

    const body = await request.json();
    const {
      prompt,
      imageUrls,
      modelOptionId,
      model,
      aspectRatio,
      watermark,
      runId,
    } = body as {
      prompt?: string;
      imageUrls?: string[];
      modelOptionId?: string;
      model?: string;
      aspectRatio?: string;
      watermark?: string;
      runId?: string;
    };

    if (!prompt) {
      return videoErrorResponse("prompt_required");
    }
    promptForPersistence = prompt;

    const option = resolveVideoOption({ modelOptionId, model });
    if (!option) {
      return videoErrorResponse("invalid_parameters");
    }

    const inputSources = Array.isArray(imageUrls)
      ? imageUrls.filter((url) => typeof url === "string" && url.trim().length > 0)
      : [];

    if (option.requiresImageInput && inputSources.length === 0) {
      return videoErrorResponse("input_image_required");
    }

    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const normalizedImageMedia =
      inputSources.length > 0
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
    const normalizedImageUrls = normalizedImageMedia?.map((media) => media.url);
    inputUrlsForPersistence = normalizedImageUrls || [];
    inputMediaForPersistence = normalizedImageMedia || [];

    parametersForPersistence = {
      model: getVideoModelName(option),
      resolution: formatVideoResolution(option.resolution),
      aspectRatio: aspectRatio || "Auto",
      duration: option.duration,
      audio: option.hasAudio ? "On" : "Off",
      mode: normalizedImageUrls?.length ? "Image to video" : "Text to video",
      ...(typeof runId === "string" && runId.trim()
        ? { runId: runId.trim().slice(0, 120), outputIndex: 0, outputCount: 1 }
        : {}),
    };

    consumedCredits = await consumeCreditsFIFO(session.user.id, option.credits);

    taskId = await createVideoTask({
      prompt,
      imageUrls: normalizedImageUrls,
      aspectRatio,
      watermark,
      option,
    });

    const generation = await prisma.generation.upsert({
      where: { taskId },
      update: {
        type: "video",
        status: "generating",
        urls: [],
        inputUrls: inputUrlsForPersistence,
        prompt,
        error: null,
        modelOptionId: option.id,
        parameters: parametersForPersistence as Prisma.InputJsonValue,
        creditsCost: option.credits,
        creditConsumption: consumedCredits as Prisma.InputJsonValue,
      },
      create: {
        userId,
        type: "video",
        status: "generating",
        urls: [],
        inputUrls: inputUrlsForPersistence,
        prompt,
        taskId,
        modelOptionId: option.id,
        parameters: parametersForPersistence as Prisma.InputJsonValue,
        creditsCost: option.credits,
        creditConsumption: consumedCredits as Prisma.InputJsonValue,
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

    return NextResponse.json({
      success: true,
      pending: true,
      status: "generating",
      prompt,
      taskId,
      creditsCost: option.credits,
      modelOptionId: option.id,
      parameters: parametersForPersistence,
      inputUrls: inputUrlsForPersistence,
    });
  } catch (error: any) {
    console.error("Error generating video:", error);
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
        console.error("Failed to refund video credits:", refundError);
      }
    }

    let errorDisplay;
    if (error instanceof InsufficientCreditsError) {
      errorDisplay = getGenerationErrorDisplay(
        {
          errorCode: "insufficient_credits",
          error: `This generation needs ${error.required} credits, but you have ${error.available}.`,
        },
        { mediaType: "video" }
      );
    } else if (error instanceof CreditConsumptionConflictError) {
      errorDisplay = getGenerationErrorDisplay(
        { errorCode: "credit_conflict" },
        { mediaType: "video" }
      );
    } else {
      errorDisplay = getGenerationErrorDisplay(error, {
        mediaType: "video",
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
            type: "video",
            status: "failed",
            error: errorDisplay.message,
            inputUrls: inputUrlsForPersistence,
            creditConsumption: refundPending
              ? (consumedCredits as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            ...(parametersForPersistence
              ? { parameters: parametersForPersistence as Prisma.InputJsonValue }
              : {}),
          },
          create: {
            userId,
            type: "video",
            status: "failed",
            urls: [],
            inputUrls: inputUrlsForPersistence,
            prompt: promptForPersistence,
            taskId,
            error: errorDisplay.message,
            creditConsumption: refundPending
              ? (consumedCredits as Prisma.InputJsonValue)
              : Prisma.JsonNull,
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
        console.error("Failed to persist video generation failure:", persistErr);
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
        mediaType: "video",
        creditsRefunded,
        refundPending,
      }
    );

    return NextResponse.json(
      {
        ...payload,
        ...(error instanceof InsufficientCreditsError
          ? { required: error.required, available: error.available }
          : {}),
      },
      { status: getGenerationErrorHttpStatus(errorDisplay.code) }
    );
  }
}
