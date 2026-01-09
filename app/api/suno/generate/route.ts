import { NextRequest, NextResponse } from "next/server";

const KIE_API_BASE = "https://api.kie.ai";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createSunoTask(params: {
  prompt: string;
  title?: string;
  tags?: string;
  makeInstrumental?: boolean;
  waitAudio?: boolean;
}) {
  const apiKey = process.env.KIE_API_KEY || process.env.NANO_BANANA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "未配置 KIE_API_KEY 环境变量，请在 .env 中添加后重试。"
    );
  }

  const body = {
    prompt: params.prompt,
    title: params.title,
    tags: params.tags,
    makeInstrumental: params.makeInstrumental || false,
    waitAudio: params.waitAudio !== false, // 默认等待音频生成完成
  };

  const res = await fetch(`${KIE_API_BASE}/api/v1/suno/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Suno createTask 返回错误:", text);
    throw new Error("创建音频生成任务失败，请稍后重试。");
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: { taskId?: string };
  };

  if (json.code !== 200 || !json.data?.taskId) {
    console.error("Suno createTask 响应异常:", json);
    throw new Error(json.msg || "创建音频生成任务失败，请稍后重试。");
  }

  return json.data.taskId;
}

async function pollSunoResult(taskId: string) {
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
      `${KIE_API_BASE}/api/v1/suno/details?taskId=${encodeURIComponent(taskId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Suno details 返回错误:", text);
      await sleep(intervalMs);
      continue;
    }

    const json = (await res.json()) as {
      code: number;
      msg: string;
      data?: {
        status?: "processing" | "completed" | "failed";
        audioUrl?: string;
        error?: string;
      };
    };

    if (json.code !== 200 || !json.data) {
      console.error("Suno details 响应异常:", json);
      await sleep(intervalMs);
      continue;
    }

    const status = json.data.status;

    if (status === "processing") {
      await sleep(intervalMs);
      continue;
    }

    if (status === "failed") {
      console.error("Suno 任务失败:", json.data.error);
      throw new Error(json.data.error || "音频生成失败，请稍后重试。");
    }

    if (status === "completed") {
      if (!json.data.audioUrl) {
        throw new Error("任务成功但未返回音频地址，请稍后重试。");
      }

      return json.data.audioUrl;
    }

    await sleep(intervalMs);
  }

  throw new Error("音频生成超时，请稍后重试。");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      title,
      tags,
      makeInstrumental,
    } = body as {
      prompt?: string;
      title?: string;
      tags?: string;
      makeInstrumental?: boolean;
    };

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt cannot be empty" },
        { status: 400 }
      );
    }

    const taskId = await createSunoTask({
      prompt,
      title,
      tags,
      makeInstrumental,
    });

    const audioUrl = await pollSunoResult(taskId);

    return NextResponse.json({
      success: true,
      audioUrl,
      prompt,
      taskId,
    });
  } catch (error: any) {
    console.error("生成音频时出错:", error);
    const message =
      typeof error?.message === "string"
        ? error.message
        : "生成音频时出错，请稍后重试。";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

