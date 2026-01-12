import { NextRequest, NextResponse } from "next/server";

const KIE_API_BASE = "https://api.kie.ai";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createVeoTask(params: {
  prompt: string;
  imageUrls?: string[];
  model?: string;
  aspectRatio?: string;
  duration?: number;
  watermark?: string;
  callBackUrl?: string;
}) {
  const apiKey = process.env.KIE_API_KEY || process.env.NANO_BANANA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "KIE_API_KEY environment variable is not configured. Please add it to .env and try again."
    );
  }

  const body = {
    prompt: params.prompt,
    imageUrls: params.imageUrls || [],
    model: params.model || "veo3_fast",
    aspectRatio: params.aspectRatio || "16:9",
    watermark: params.watermark,
    callBackUrl: params.callBackUrl,
    enableTranslation: true,
    generationType: params.imageUrls && params.imageUrls.length > 0 ? "REFERENCE_2_VIDEO" : "TEXT_2_VIDEO",
  };

  const res = await fetch(`${KIE_API_BASE}/api/v1/veo/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("VEO3.1 createTask returned error:", text);
    throw new Error("Failed to create video generation task. Please try again later.");
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: { taskId?: string };
  };

  if (json.code !== 200 || !json.data?.taskId) {
    console.error("VEO3.1 createTask response异常:", json);
    throw new Error(json.msg || "Failed to create video generation task. Please try again later.");
  }

  return json.data.taskId;
}

async function pollVeoResult(taskId: string) {
  const apiKey = process.env.KIE_API_KEY || process.env.NANO_BANANA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "KIE_API_KEY environment variable is not configured. Please add it to .env and try again."
    );
  }

  const maxWaitMs = 300_000; // 最长等待 5 分钟
  const intervalMs = 5_000; // 每 5 秒轮询一次
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `${KIE_API_BASE}/api/v1/veo/details?taskId=${encodeURIComponent(taskId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("VEO3.1 details returned error:", text);
      await sleep(intervalMs);
      continue;
    }

    const json = (await res.json()) as {
      code: number;
      msg: string;
      data?: {
        status?: "processing" | "completed" | "failed";
        videoUrl?: string;
        error?: string;
      };
    };

    if (json.code !== 200 || !json.data) {
      console.error("VEO3.1 details response异常:", json);
      await sleep(intervalMs);
      continue;
    }

    const status = json.data.status;

    if (status === "processing") {
      await sleep(intervalMs);
      continue;
    }

    if (status === "failed") {
    console.error("VEO3.1 task failed:", json.data.error);
    throw new Error(json.data.error || "Video generation failed. Please try again later.");
    }

    if (status === "completed") {
      if (!json.data.videoUrl) {
        throw new Error("Task succeeded but did not return video URL. Please try again later.");
      }

      return json.data.videoUrl;
    }

    await sleep(intervalMs);
  }

  throw new Error("Video generation timeout. Please try again later.");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      imageUrls,
      model,
      aspectRatio,
      duration,
      watermark,
    } = body as {
      prompt?: string;
      imageUrls?: string[];
      model?: string;
      aspectRatio?: string;
      duration?: number;
      watermark?: string;
    };

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt cannot be empty" },
        { status: 400 }
      );
    }

    const taskId = await createVeoTask({
      prompt,
      imageUrls,
      model,
      aspectRatio,
      duration,
      watermark,
    });

    const videoUrl = await pollVeoResult(taskId);

    return NextResponse.json({
      success: true,
      videoUrl,
      prompt,
      taskId,
    });
  } catch (error: any) {
    console.error("Error generating video:", error);
    const message =
      typeof error?.message === "string"
        ? error.message
        : "Error generating video. Please try again later.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

