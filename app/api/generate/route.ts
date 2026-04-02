import { NextRequest, NextResponse } from "next/server";

const NANO_BANANA_API_BASE = "https://api.kie.ai";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createNanoBananaTask(params: {
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  outputFormat?: "png" | "jpg" | "jpeg";
  imageInput?: string[];
}) {
  const apiKey =
    process.env.NANO_BANANA_API_KEY || process.env.KIE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "NANO_BANANA_API_KEY or KIE_API_KEY environment variable is not configured. Please add it to .env and try again."
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

  if (params.imageInput?.length) {
    input.image_input = params.imageInput;
  }

  const body = {
    model: "nano-banana-2",
    input,
  };

  const res = await fetch(`${NANO_BANANA_API_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Nano Banana createTask returned error:", text);
    throw new Error("Failed to create generation task. Please try again later.");
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: { taskId?: string };
  };

  if (json.code !== 200 || !json.data?.taskId) {
    console.error("Nano Banana createTask response异常:", json);
    throw new Error(json.msg || "Failed to create generation task. Please try again later.");
  }

  return json.data.taskId;
}

async function pollNanoBananaResult(taskId: string) {
  const apiKey =
    process.env.NANO_BANANA_API_KEY || process.env.KIE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "NANO_BANANA_API_KEY or KIE_API_KEY environment variable is not configured. Please add it to .env and try again."
    );
  }

  const maxWaitMs = 60_000; // 最长等待 60 秒
  const intervalMs = 2_000; // 每 2 秒轮询一次
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `${NANO_BANANA_API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(
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
    console.error("Nano Banana recordInfo returned error:", text);
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
    console.error("Nano Banana recordInfo response异常:", json);
    throw new Error(json.msg || "Failed to query task status. Please try again later.");
    }

    const state = json.data.state;

    if (state === "waiting") {
      await sleep(intervalMs);
      continue;
    }

    if (state === "fail") {
    console.error("Nano Banana task failed:", json.data.failMsg);
    throw new Error(json.data.failMsg || "Generation failed. Please try again later.");
    }

    if (state === "success") {
      if (!json.data.resultJson) {
        throw new Error("Task succeeded but did not return results. Please try again later.");
      }

      // resultJson 是一个 JSON 字符串，例如：
      // {"resultUrls":["https://...png"]}
      let parsed: unknown;
      try {
        parsed = JSON.parse(json.data.resultJson);
      } catch (e) {
        console.error("Error parsing resultJson:", e, json.data.resultJson);
        throw new Error("Failed to parse generation results. Please try again later.");
      }

      const result = parsed as { resultUrls?: string[] };
      const imageUrl = result.resultUrls?.[0];

      if (!imageUrl) {
        throw new Error("Generated image URL not found. Please try again later.");
      }

      return imageUrl;
    }

    // 非预期状态，等待一会儿再试
    await sleep(intervalMs);
  }

  throw new Error("Generation timeout. Please try again later.");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      imageUrl,
      resolution,
      aspectRatio,
    } = body as {
      prompt?: string;
      imageUrl?: string | null;
      mode?: "text-to-image" | "image-to-image";
      resolution?: string;
      aspectRatio?: string;
    };

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt cannot be empty" },
        { status: 400 }
      );
    }

    const ar = aspectRatio && aspectRatio.trim() !== "" ? aspectRatio : "1:1";
    const res = resolution && resolution.trim() !== "" ? resolution : "1K";

    const imageInput =
      imageUrl && String(imageUrl).trim() !== ""
        ? [String(imageUrl).trim()]
        : undefined;

    const taskId = await createNanoBananaTask({
      prompt,
      aspectRatio: ar,
      resolution: res,
      outputFormat: "png",
      imageInput,
    });

    const generatedImageUrl = await pollNanoBananaResult(taskId);

    return NextResponse.json({
      success: true,
      imageUrl: generatedImageUrl,
      prompt,
      taskId,
    });
  } catch (error: any) {
    console.error("Error generating image:", error);
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
