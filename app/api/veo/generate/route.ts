import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, type Generation } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { matchesRequestAccount } from "@/lib/account-scope";
import { getKieApiKey } from "@/lib/kie";
import {
  attachGenerationTask, completeGeneration, failGeneration, isActiveGeneration,
  claimGenerationOutput, recordGenerationOutputPath, finishGenerationOutputAttempt,
  recoverGenerationObligations, reserveGeneration, withGenerationAccount, VIDEO_TASK_TIMEOUT_MS,
  type GenerationAccount,
} from "@/lib/generation-lifecycle";
import { generationErrorResponse, generationResponse, generationUncertainResponse } from "@/lib/generation-response";
import { getVideoPollingTarget } from "@/lib/video-polling-target";
import {
  VIDEO_MODEL_OPTION_MAP,
  VIDEO_MODEL_OPTIONS,
  DEFAULT_VIDEO_ASPECT_RATIOS,
  formatVideoResolution,
  getVideoModelName,
  type VideoModelOption,
  type VideoModelOptionId,
} from "@/lib/generation-pricing";
import { getVideoInputCapabilities } from "@/lib/generation-input-capabilities";
import {
  getKieVideoAspectRatio,
  getKieMarketVideoTaskBody,
} from "@/lib/kie-video-request";
import { parseKieVideoResult, type KieVideoResultData } from "@/lib/kie-video-result";
import {
  ProviderGenerationError,
  getGenerationErrorHttpStatus,
  getGenerationErrorPayload,
  type GenerationErrorCode,
} from "@/lib/generation-errors";
import { persistGeneratedMedia } from "@/lib/media-storage";
import {
  persistOrReuseMediaInput,
  enforceInputMediaSize,
} from "@/lib/media-assets";
import {
  buildVolcengineVideoTaskBody,
  parseVolcengineVideoResult,
} from "@/lib/volcengine-video-request";
import type { VideoReferenceInput } from "@/lib/video-reference-input";

const KIE_API_BASE = "https://api.kie.ai";
const VOLCENGINE_API_BASE = "https://ark.cn-beijing.volces.com/api/v3";
export const maxDuration = 300;

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
  { create: string; detail: string; style: "veo" | "market" | "volcengine" }
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
  seedance: {
    create: "/api/v1/jobs/createTask",
    detail: "/api/v1/jobs/recordInfo",
    style: "market",
  },
  gemini: {
    create: "/api/v1/jobs/createTask",
    detail: "/api/v1/jobs/recordInfo",
    style: "market",
  },
  wan: {
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
    const byId = Object.hasOwn(VIDEO_MODEL_OPTION_MAP, params.modelOptionId)
      ? VIDEO_MODEL_OPTION_MAP[params.modelOptionId as VideoModelOptionId] : null;
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
  inputs?: VideoReferenceInput[];
  aspectRatio?: string;
  generateAudio?: boolean;
  watermark?: string;
  option: VideoModelOption;
}) {
  if (params.option.provider === "volcengine") {
    const apiKey = process.env.VOLCENGINE_ARK_API_KEY;
    if (!apiKey) throw new Error("VOLCENGINE_ARK_API_KEY environment variable is not configured.");
    const res = await fetch(`${VOLCENGINE_API_BASE}/contents/generations/tasks`, {
      signal: AbortSignal.timeout(30_000),
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(buildVolcengineVideoTaskBody({
        prompt: params.prompt,
        inputs: params.inputs || [],
        aspectRatio: params.aspectRatio,
        generateAudio: params.generateAudio !== false,
        option: params.option,
      })),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Volcengine video task creation failed:", text);
      throw new ProviderGenerationError(text || res.statusText, res.status);
    }
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new ProviderGenerationError("Volcengine did not return a task id.");
    return json.id;
  }

  const apiKey = getKieApiKey();
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
      inputs: params.inputs,
      aspectRatio: params.aspectRatio,
      generateAudio: params.generateAudio,
      option: params.option,
    });
  }

  const res = await fetch(`${KIE_API_BASE}${endpoint}`, {
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

async function getVideoResultOnce(taskId: string, option: Pick<VideoModelOption, "provider" | "family">) {
  if (option.provider === "volcengine") {
    const apiKey = process.env.VOLCENGINE_ARK_API_KEY;
    if (!apiKey) throw new Error("VOLCENGINE_ARK_API_KEY environment variable is not configured.");
    try {
      const res = await fetch(`${VOLCENGINE_API_BASE}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
        signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          return { state: "failed" as const, error: new ProviderGenerationError(text || res.statusText, res.status).message };
        }
        return { state: "pending" as const };
      }
      return parseVolcengineVideoResult(await res.json());
    } catch (error) {
      console.error("Volcengine video details request failed:", error);
      return { state: "pending" as const };
    }
  }

  const apiKey = getKieApiKey();
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
      signal: AbortSignal.timeout(10_000),
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

async function settleVideoTask(account: GenerationAccount, identifier: string) {
  const generation = await withGenerationAccount(account, (tx) => tx.generation.findFirst({
    where: { userId: account.id, type: "video", OR: [{ taskId: identifier }, { id: identifier }] },
  }));
  if (!generation) return videoErrorResponse("task_not_found");
  if (generation.status === "failed") {
    const settled = await failGeneration({ account, id: generation.id, error: generation.error || { errorCode: "generation_failed" } });
    return generationResponse(settled.generation);
  }
  if (!isActiveGeneration(generation.status)) return generationResponse(generation);
  const fail = async (error: unknown, source: "app" | "provider" = "app", attemptId?: string) =>
    generationResponse((await failGeneration({ account, id: generation.id, error, source, attemptId })).generation);
  const target = getVideoPollingTarget(generation.modelOptionId, generation.parameters);
  if (!generation.taskId || !target) {
    return Date.now() - generation.createdAt.getTime() >= VIDEO_TASK_TIMEOUT_MS
      ? fail({ errorCode: "timeout" }) : generationResponse(generation);
  }
  const result = await getVideoResultOnce(generation.taskId, target);
  if (result.state === "pending") {
    return Date.now() - generation.createdAt.getTime() >= VIDEO_TASK_TIMEOUT_MS
      ? fail({ errorCode: "timeout" }) : generationResponse(generation);
  }
  if (result.state === "failed") return fail(result.error, "provider");
  const claimed = await claimGenerationOutput(account, generation.id);
  const attemptId = claimed.attemptId;
  if (!attemptId) return generationResponse(claimed.generation);
  let outputUploadAcknowledged = false;
  try {
    const output = await persistGeneratedMedia({
      sourceUrl: result.url, userId: account.id, taskId: generation.taskId, kind: "video",
      beforeUpload: (pathname) => recordGenerationOutputPath(account, generation.id, attemptId, pathname),
    });
    outputUploadAcknowledged = true;
    const settled = await completeGeneration({ account, id: generation.id, attemptId,
      output: { media: output, role: "output", type: "video", position: 0 },
    });
    return generationResponse(settled.generation);
  } catch (error) {
    console.error("Video persistence/settlement failed:", error);
    return await fail({ errorCode: "media_processing_failed" }, "app", attemptId);
  } finally {
    await finishGenerationOutputAttempt(account, generation.id, attemptId, outputUploadAcknowledged);
  }
}

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
