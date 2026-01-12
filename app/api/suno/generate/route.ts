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
      "KIE_API_KEY environment variable is not configured. Please add it to .env and try again."
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
    console.error("Suno createTask returned error:", text);
    throw new Error("Failed to create audio generation task. Please try again later.");
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: { taskId?: string };
  };

  if (json.code !== 200 || !json.data?.taskId) {
    console.error("Suno createTask response异常:", json);
    throw new Error(json.msg || "Failed to create audio generation task. Please try again later.");
  }

  return json.data.taskId;
}

async function pollSunoResult(taskId: string) {
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
      console.error("Suno details returned error:", text);
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
      console.error("Suno details response异常:", json);
      await sleep(intervalMs);
      continue;
    }

    const status = json.data.status;

    if (status === "processing") {
      await sleep(intervalMs);
      continue;
    }

    if (status === "failed") {
    console.error("Suno task failed:", json.data.error);
    throw new Error(json.data.error || "Audio generation failed. Please try again later.");
    }

    if (status === "completed") {
      if (!json.data.audioUrl) {
        throw new Error("Task succeeded but did not return audio URL. Please try again later.");
      }

      return json.data.audioUrl;
    }

    await sleep(intervalMs);
  }

  throw new Error("Audio generation timeout. Please try again later.");
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
    console.error("Error generating audio:", error);
    const message =
      typeof error?.message === "string"
        ? error.message
        : "Error generating audio. Please try again later.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

