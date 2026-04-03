import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
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

const KIE_API_BASE = "https://api.kie.ai";

const FAMILY_ENDPOINTS: Record<
  VideoModelOption["family"],
  { create: string; detail: string; style: "veo" | "market" }
> = {
  veo: {
    create: "/api/v1/veo/generate",
    detail: "/api/v1/veo/details",
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
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  } else {
    body = {
      model: params.option.providerModel,
      input: {
        prompt: params.prompt,
        input_urls: params.imageUrls || [],
        aspect_ratio: params.aspectRatio || "16:9",
        resolution:
          params.option.resolution === "1080P" ? "1080p" : "720p",
        duration: String(params.option.duration),
        generate_audio: !!params.option.hasAudio,
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

async function pollVideoResult(taskId: string, option: VideoModelOption) {
  const apiKey = process.env.KIE_API_KEY || process.env.NANO_BANANA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "KIE_API_KEY environment variable is not configured. Please add it to .env and try again."
    );
  }

  const endpoint = FAMILY_ENDPOINTS[option.family].detail;
  const endpointStyle = FAMILY_ENDPOINTS[option.family].style;
  const maxWaitMs = 300_000;
  const intervalMs = 5_000;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const detailUrl =
      endpointStyle === "veo"
        ? `${KIE_API_BASE}${endpoint}?taskId=${encodeURIComponent(taskId)}`
        : `${KIE_API_BASE}${endpoint}?taskId=${encodeURIComponent(taskId)}`;
    const res = await fetch(detailUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Video details returned error:", text);
      await sleep(intervalMs);
      continue;
    }

    const json = (await res.json()) as {
      code: number;
      msg: string;
      data?: {
        status?: string;
        state?: string;
        videoUrl?: string;
        resultUrl?: string;
        outputUrl?: string;
        resultJson?: string | null;
        failMsg?: string | null;
        error?: string;
      };
    };

    if (json.code !== 200 || !json.data) {
      console.error("Video details response error:", json);
      await sleep(intervalMs);
      continue;
    }

    const rawStatus = json.data.status || json.data.state || "";
    const status = rawStatus.toLowerCase();

    if (status === "processing" || status === "waiting" || status === "pending") {
      await sleep(intervalMs);
      continue;
    }

    if (status === "failed" || status === "fail") {
      throw new Error(
        json.data.error ||
          json.data.failMsg ||
          "Video generation failed. Please try again later."
      );
    }

    if (status === "completed" || status === "success") {
      const directUrl =
        json.data.videoUrl || json.data.resultUrl || json.data.outputUrl;
      if (directUrl) {
        return directUrl;
      }

      if (json.data.resultJson) {
        try {
          const parsed = JSON.parse(json.data.resultJson) as {
            videoUrl?: string;
            resultUrl?: string;
            resultUrls?: string[];
            videos?: Array<{ url?: string }>;
          };
          const parsedUrl =
            parsed.videoUrl ||
            parsed.resultUrl ||
            parsed.resultUrls?.[0] ||
            parsed.videos?.[0]?.url;
          if (parsedUrl) {
            return parsedUrl;
          }
        } catch (e) {
          console.error("Error parsing video resultJson:", e);
        }
      }

      throw new Error("Task succeeded but did not return video URL. Please try again later.");
    }

    await sleep(intervalMs);
  }

  throw new Error("Video generation timeout. Please try again later.");
}

export async function GET() {
  return NextResponse.json({
    success: true,
    options: VIDEO_MODEL_OPTIONS,
  });
}

export async function POST(request: NextRequest) {
  let consumedCredits: CreditConsumptionSnapshot = [];
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const option = resolveVideoOption({ modelOptionId, model });
    if (!option) {
      return NextResponse.json(
        { error: "Unsupported video model option." },
        { status: 400 }
      );
    }

    consumedCredits = await consumeCreditsFIFO(session.user.id, option.credits);

    const taskId = await createVideoTask({
      prompt,
      imageUrls,
      aspectRatio,
      watermark,
      option,
    });

    const videoUrl = await pollVideoResult(taskId, option);

    return NextResponse.json({
      success: true,
      videoUrl,
      prompt,
      taskId,
      creditsCost: option.credits,
      modelOptionId: option.id,
    });
  } catch (error: any) {
    console.error("Error generating video:", error);
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

    const message =
      typeof error?.message === "string"
        ? error.message
        : "Error generating video. Please try again later.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
