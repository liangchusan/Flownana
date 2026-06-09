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
  type VideoModelOption,
  type VideoModelOptionId,
} from "@/lib/generation-pricing";
import { parseKieVideoResult, type KieVideoResultData } from "@/lib/kie-video-result";
import { persistGeneratedMedia } from "@/lib/media-storage";

const KIE_API_BASE = "https://api.kie.ai";

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
};

function resolveVideoOption(params: {
  modelOptionId?: string;
  model?: string;
}): VideoModelOption | null {
  if (params.modelOptionId) {
    const byId = VIDEO_MODEL_OPTION_MAP[params.modelOptionId as VideoModelOptionId];
    if (byId) return byId;
  }

  switch (params.model) {
    case "veo3_lite":
      return VIDEO_MODEL_OPTION_MAP.veo31_lite_8;
    case "veo3_quality":
      return VIDEO_MODEL_OPTION_MAP.veo31_quality_8;
    case "veo3_fast":
    default:
      return VIDEO_MODEL_OPTION_MAP.veo31_fast_8;
  }
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
  let body: Record<string, unknown>;
  if (endpointStyle === "veo") {
    body = {
      prompt: params.prompt,
      imageUrls: params.imageUrls || [],
      model: params.option.providerModel,
      aspectRatio: params.aspectRatio || "16:9",
      duration: params.option.duration,
      watermark: params.watermark,
      enableTranslation: true,
      generationType:
        params.imageUrls && params.imageUrls.length > 0
          ? "REFERENCE_2_VIDEO"
          : "TEXT_2_VIDEO",
    };
  } else if (params.option.family === "kling") {
    body = {
      model: params.option.providerModel,
      input: {
        prompt: params.prompt,
        image_urls: params.imageUrls || [],
        aspect_ratio: params.aspectRatio || "16:9",
        duration: String(params.option.duration),
        // Kling 3.0 uses mode tiers; map 1080P to pro, 720P to standard.
        mode: params.option.resolution === "1080P" ? "pro" : "standard",
        sound: !!params.option.hasAudio,
      },
    };
  } else if (params.option.family === "happyhorse") {
    body = {
      model: params.option.providerModel,
      input: {
        prompt: params.prompt,
        resolution: params.option.resolution === "1080P" ? "1080p" : "720p",
        aspect_ratio: params.aspectRatio || "16:9",
        duration: params.option.duration,
      },
    };
  } else {
    const [firstFrameUrl, lastFrameUrl] = params.imageUrls || [];

    body = {
      model: params.option.providerModel,
      input: {
        prompt: params.prompt,
        first_frame_url: firstFrameUrl,
        last_frame_url: lastFrameUrl,
        aspect_ratio: params.aspectRatio || "16:9",
        resolution:
          params.option.resolution === "1080P"
            ? "1080p"
            : params.option.resolution === "480P"
              ? "480p"
              : "720p",
        duration: params.option.duration,
        generate_audio: !!params.option.hasAudio,
        web_search: false,
      },
    };
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
    throw new Error("Failed to create video generation task. Please try again later.");
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: { taskId?: string };
  };

  if (json.code !== 200 || !json.data?.taskId) {
    console.error("Video createTask response error:", json);
    throw new Error(json.msg || "Failed to create video generation task. Please try again later.");
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
  const res = await fetch(detailUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Video details returned error:", text);
    return { state: "pending" as const };
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: KieVideoResultData;
  };

  if (json.code !== 200 || !json.data) {
    console.error("Video details response error:", json);
    return { state: "pending" as const };
  }

  return parseKieVideoResult(json.data);
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
    return NextResponse.json({ error: "Generation not found." }, { status: 404 });
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
    });
  }

  if (generation.status === "failed") {
    return NextResponse.json(
      {
        success: false,
        pending: false,
        status: generation.status,
        error: generation.error || "Generation failed.",
        prompt: generation.prompt,
        taskId: generation.taskId,
      },
      { status: 500 }
    );
  }

  const result = await getVideoResultOnce(params.taskId, params.option);
  if (result.state === "pending") {
    return NextResponse.json({
      success: true,
      pending: true,
      status: generation.status,
      prompt: generation.prompt,
      taskId: generation.taskId,
      creditsCost: generation.creditsCost,
      modelOptionId: generation.modelOptionId,
    });
  }

  if (result.state === "failed") {
    const consumedCredits = normalizeCreditConsumptionSnapshot(
      generation.creditConsumption
    );
    if (consumedCredits.length > 0) {
      try {
        await refundConsumedCredits(consumedCredits);
      } catch (refundError) {
        console.error("Failed to refund async video credits:", refundError);
      }
    }

    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: "failed",
        error: result.error,
        creditConsumption: Prisma.JsonNull,
      },
    });

    return NextResponse.json(
      {
        success: false,
        pending: false,
        status: "failed",
        error: result.error,
        prompt: generation.prompt,
        taskId: generation.taskId,
      },
      { status: 500 }
    );
  }

  const videoUrl = await persistGeneratedMedia({
    sourceUrl: result.url,
    userId: params.userId,
    taskId: params.taskId,
    kind: "video",
  });

  await prisma.generation.update({
    where: { id: generation.id },
    data: {
      status: "success",
      urls: [videoUrl],
      error: null,
      creditConsumption: Prisma.JsonNull,
    },
  });

  return NextResponse.json({
    success: true,
    pending: false,
    status: "success",
    videoUrl,
    prompt: generation.prompt,
    taskId: generation.taskId,
    creditsCost: generation.creditsCost,
    modelOptionId: generation.modelOptionId,
  });
}

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get("taskId");
  if (taskId) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please sign in to view generation status." },
        { status: 401 }
      );
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
      return NextResponse.json(
        { error: "Unsupported video model option." },
        { status: 400 }
      );
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
  let consumedCredits: CreditConsumptionSnapshot = [];
  let taskId: string | undefined;
  let userId: string | undefined;
  let promptForPersistence = "Untitled prompt";
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please sign in to generate videos." },
        { status: 401 }
      );
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
    } = body as {
      prompt?: string;
      imageUrls?: string[];
      modelOptionId?: string;
      model?: string;
      aspectRatio?: string;
      watermark?: string;
    };

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt cannot be empty" },
        { status: 400 }
      );
    }
    promptForPersistence = prompt;

    const option = resolveVideoOption({ modelOptionId, model });
    if (!option) {
      return NextResponse.json(
        { error: "Unsupported video model option." },
        { status: 400 }
      );
    }

    consumedCredits = await consumeCreditsFIFO(session.user.id, option.credits);

    taskId = await createVideoTask({
      prompt,
      imageUrls,
      aspectRatio,
      watermark,
      option,
    });

    await prisma.generation.upsert({
      where: { taskId },
      update: {
        type: "video",
        status: "generating",
        urls: [],
        prompt,
        error: null,
        modelOptionId: option.id,
        creditsCost: option.credits,
        creditConsumption: consumedCredits as Prisma.InputJsonValue,
      },
      create: {
        userId,
        type: "video",
        status: "generating",
        urls: [],
        prompt,
        taskId,
        modelOptionId: option.id,
        creditsCost: option.credits,
        creditConsumption: consumedCredits as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      pending: true,
      status: "generating",
      prompt,
      taskId,
      creditsCost: option.credits,
      modelOptionId: option.id,
    });
  } catch (error: any) {
    console.error("Error generating video:", error);
    if (taskId && userId) {
      try {
        await prisma.generation.upsert({
          where: { taskId },
          update: {
            type: "video",
            status: "failed",
            error:
              typeof error?.message === "string"
                ? error.message
                : "Generation failed.",
          },
          create: {
            userId,
            type: "video",
            status: "failed",
            urls: [],
            prompt: promptForPersistence,
            taskId,
            error:
              typeof error?.message === "string"
                ? error.message
                : "Generation failed.",
          },
        });
      } catch (persistErr) {
        console.error("Failed to persist video generation failure:", persistErr);
      }
    }
    if (consumedCredits.length > 0) {
      try {
        await refundConsumedCredits(consumedCredits);
      } catch (refundError) {
        console.error("Failed to refund video credits:", refundError);
      }
    }

    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: `Insufficient credits. Required ${error.required}, available ${error.available}.`,
          required: error.required,
          available: error.available,
        },
        { status: 402 }
      );
    }

    if (error instanceof CreditConsumptionConflictError) {
      return NextResponse.json(
        { error: "Credit balance changed. Please retry generation." },
        { status: 409 }
      );
    }

    const message =
      typeof error?.message === "string"
        ? error.message
        : "Error generating video. Please try again later.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
