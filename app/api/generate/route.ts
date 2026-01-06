import { NextRequest, NextResponse } from "next/server";

const NANO_BANANA_API_BASE = "https://api.kie.ai";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createNanoBananaTask(params: {
  prompt: string;
  imageSize?: string;
  outputFormat?: "png" | "jpeg";
}) {
  const apiKey = process.env.NANO_BANANA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "未配置 NANO_BANANA_API_KEY 环境变量，请在 .env 中添加后重试。"
    );
  }

  const body = {
    model: "google/nano-banana",
    input: {
      prompt: params.prompt,
      output_format: params.outputFormat ?? "png",
      image_size: params.imageSize ?? "1:1",
    },
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
    console.error("Nano Banana createTask 返回错误:", text);
    throw new Error("创建生成任务失败，请稍后重试。");
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: { taskId?: string };
  };

  if (json.code !== 200 || !json.data?.taskId) {
    console.error("Nano Banana createTask 响应异常:", json);
    throw new Error(json.msg || "创建生成任务失败，请稍后重试。");
  }

  return json.data.taskId;
}

async function pollNanoBananaResult(taskId: string) {
  const apiKey = process.env.NANO_BANANA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "未配置 NANO_BANANA_API_KEY 环境变量，请在 .env 中添加后重试。"
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
      console.error("Nano Banana recordInfo 返回错误:", text);
      throw new Error("查询任务状态失败，请稍后重试。");
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
      console.error("Nano Banana recordInfo 响应异常:", json);
      throw new Error(json.msg || "查询任务状态失败，请稍后重试。");
    }

    const state = json.data.state;

    if (state === "waiting") {
      await sleep(intervalMs);
      continue;
    }

    if (state === "fail") {
      console.error("Nano Banana 任务失败:", json.data.failMsg);
      throw new Error(json.data.failMsg || "生成失败，请稍后重试。");
    }

    if (state === "success") {
      if (!json.data.resultJson) {
        throw new Error("任务成功但未返回结果，请稍后重试。");
      }

      // resultJson 是一个 JSON 字符串，例如：
      // {"resultUrls":["https://...png"]}
      let parsed: unknown;
      try {
        parsed = JSON.parse(json.data.resultJson);
      } catch (e) {
        console.error("解析 resultJson 出错:", e, json.data.resultJson);
        throw new Error("解析生成结果失败，请稍后重试。");
      }

      const result = parsed as { resultUrls?: string[] };
      const imageUrl = result.resultUrls?.[0];

      if (!imageUrl) {
        throw new Error("未找到生成的图像地址，请稍后重试。");
      }

      return imageUrl;
    }

    // 非预期状态，等待一会儿再试
    await sleep(intervalMs);
  }

  throw new Error("生成超时，请稍后重试。");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      imageUrl: _imageUrl, // 目前 Nano Banana API 暂未开放图像编辑参数，这里预留
      mode,
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
        { error: "提示词不能为空" },
        { status: 400 }
      );
    }

    // 将前端传入的宽高比映射到 Nano Banana 的 image_size
    const imageSize =
      aspectRatio && aspectRatio.trim() !== "" ? aspectRatio : "1:1";

    // 未来如果官方支持图像编辑，可以根据 mode 和 imageUrl 扩展 input 参数
    if (mode === "image-to-image") {
      console.warn(
        "当前 Nano Banana 官方文档未提供图像编辑参数支持，已按文本生图处理。"
      );
    }

    const taskId = await createNanoBananaTask({
      prompt,
      imageSize,
      outputFormat: "png",
    });

    const generatedImageUrl = await pollNanoBananaResult(taskId);

    return NextResponse.json({
      success: true,
      imageUrl: generatedImageUrl,
      prompt,
      taskId,
    });
  } catch (error: any) {
    console.error("生成图像时出错:", error);
    const message =
      typeof error?.message === "string"
        ? error.message
        : "生成图像时出错，请稍后重试。";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
