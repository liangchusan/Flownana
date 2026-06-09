import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
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
import { persistGeneratedMedia } from "@/lib/media-storage";

const KIE_API_BASE = "https://api.kie.ai";
const DEFAULT_IMAGE_MODEL_ID: ImageModelOptionId = "gpt-image-2";
const IMAGE_ASPECT_RATIOS = new Set([
  "auto",
  "9:16",
  "16:9",
  "1:1",
  "3:4",
  "4:3",
]);

export const maxDuration = 300;

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
    aspect_ratio: params.aspectRatio?.trim() || "1:1",
    resolution: params.resolution?.trim() || "1K",
    output_format: fmt,
  };

  if (params.inputUrls?.length) {
    if (params.modelId === "nano-banana-2") {
      input.image_input = params.inputUrls;
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
    throw new Error("Failed to create generation task. Please try again later.");
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: { taskId?: string };
  };

  if (json.code !== 200 || !json.data?.taskId) {
    console.error(`${modelOption.label} createTask response error:`, json);
    throw new Error(
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
      throw new Error("Failed to query task status. Please try again later.");
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
      throw new Error(
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
      throw new Error(
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
  let consumedCredits: CreditConsumptionSnapshot = [];
  let taskId: string | undefined;
  let userId: string | undefined;
  let promptForPersistence = "Untitled prompt";
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = session.user.id;

    const body = await request.json();
    const {
      prompt,
      imageUrl,
      model,
      resolution,
      aspectRatio,
    } = body as {
      prompt?: string;
      imageUrl?: string | null;
      mode?: "text-to-image" | "image-to-image";
      model?: string;
      resolution?: string;
      aspectRatio?: string;
    };

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt cannot be empty" },
        { status: 400 }
      );
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
    const cost = getImageGenerationCredits(modelId, res);
    if (!cost) {
      return NextResponse.json(
        { error: "Unsupported resolution." },
        { status: 400 }
      );
    }

    if (
      !isValidImageAspectRatio({ modelId, resolution: res, aspectRatio: ar })
    ) {
      return NextResponse.json(
        { error: "Unsupported aspect ratio for this resolution." },
        { status: 400 }
      );
    }

    consumedCredits = await consumeCreditsFIFO(session.user.id, cost);

    const inputUrls =
      imageUrl && String(imageUrl).trim() !== ""
        ? [String(imageUrl).trim()]
        : undefined;

    taskId = await createImageTask({
      modelId,
      prompt,
      aspectRatio: ar,
      resolution: res,
      outputFormat: "png",
      inputUrls,
    });

    const providerImageUrl = await pollImageResult(taskId, modelOption.label);
    const generatedImageUrl = await persistGeneratedMedia({
      sourceUrl: providerImageUrl,
      userId: session.user.id,
      taskId,
      kind: "image",
    });

    await prisma.generation.upsert({
      where: { taskId },
      update: {
        type: "image",
        status: "success",
        urls: [generatedImageUrl],
        prompt,
        error: null,
        modelOptionId: inputUrls?.length
          ? modelOption.imageToImageModel
          : modelOption.textToImageModel,
        creditsCost: cost,
      },
      create: {
        userId,
        type: "image",
        status: "success",
        urls: [generatedImageUrl],
        prompt,
        taskId,
        modelOptionId: inputUrls?.length
          ? modelOption.imageToImageModel
          : modelOption.textToImageModel,
        creditsCost: cost,
      },
    });

    return NextResponse.json({
      success: true,
      imageUrl: generatedImageUrl,
      prompt,
      taskId,
      creditsCost: cost,
    });
  } catch (error: any) {
    console.error("Error generating image:", error);
    if (taskId && userId) {
      try {
        await prisma.generation.upsert({
          where: { taskId },
          update: {
            type: "image",
            status: "failed",
            error:
              typeof error?.message === "string"
                ? error.message
                : "Generation failed.",
          },
          create: {
            userId,
            type: "image",
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
        console.error("Failed to persist image generation failure:", persistErr);
      }
    }

    if (consumedCredits.length > 0) {
      try {
        await refundConsumedCredits(consumedCredits);
      } catch (refundError) {
        console.error("Failed to refund image credits:", refundError);
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
        : "Error generating image. Please try again later.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
