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
      "未配置 KIE_API_KEY 环境变量，请在 .env 中添加后重试。"
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
    console.error("VEO3.1 createTask 返回错误:", text);
    throw new Error("创建视频生成任务失败，请稍后重试。");
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: { taskId?: string };
  };

  if (json.code !== 200 || !json.data?.taskId) {
    console.error("VEO3.1 createTask 响应异常:", json);
    throw new Error(json.msg || "创建视频生成任务失败，请稍后重试。");
  }

  return json.data.taskId;
}

async function pollVeoResult(taskId: string) {
  const apiKey = process.env.KIE_API_KEY || process.env.NANO_BANANA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "未配置 KIE_API_KEY 环境变量，请在 .env 中添加后重试。"
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
      console.error("VEO3.1 details 返回错误:", text);
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
      console.error("VEO3.1 details 响应异常:", json);
      await sleep(intervalMs);
      continue;
    }

    const status = json.data.status;

    if (status === "processing") {
      await sleep(intervalMs);
      continue;
    }

    if (status === "failed") {
      console.error("VEO3.1 任务失败:", json.data.error);
      throw new Error(json.data.error || "视频生成失败，请稍后重试。");
    }

    if (status === "completed") {
      if (!json.data.videoUrl) {
        throw new Error("任务成功但未返回视频地址，请稍后重试。");
      }

      return json.data.videoUrl;
    }

    await sleep(intervalMs);
  }

  throw new Error("视频生成超时，请稍后重试。");
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
    console.error("生成视频时出错:", error);
    const message =
      typeof error?.message === "string"
        ? error.message
        : "生成视频时出错，请稍后重试。";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

