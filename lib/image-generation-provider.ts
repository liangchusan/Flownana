import { getKieApiKey } from "@/lib/kie";
import { IMAGE_MODEL_OPTION_MAP, type ImageModelOptionId, type ImageResolutionKey } from "@/lib/generation-pricing";
import { ProviderGenerationError } from "@/lib/generation-errors";
import { buildKieImageRequest } from "@/lib/kie-image-request";
const KIE_API_BASE = "https://api.kie.ai";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createImageTask(params: {
  modelId: ImageModelOptionId;
  prompt: string;
  aspectRatio: string;
  resolution?: ImageResolutionKey;
  inputUrls?: string[];
}) {
  const apiKey = getKieApiKey();

  if (!apiKey) {
    throw new Error(
      "KIE_API_KEY environment variable is not configured. Please add it to .env and try again."
    );
  }

  const modelOption = IMAGE_MODEL_OPTION_MAP[params.modelId];
  const body = buildKieImageRequest(params);

  const res = await fetch(`${KIE_API_BASE}/api/v1/jobs/createTask`, {
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
    console.error(`${modelOption.label} createTask returned error:`, text);
    throw new ProviderGenerationError(text || res.statusText, res.status);
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: { taskId?: string };
  };

  if (json.code !== 200 || !json.data?.taskId) {
    console.error(`${modelOption.label} createTask response error:`, json);
    throw new ProviderGenerationError(
      json.msg || "Failed to create generation task. Please try again later."
    );
  }

  return json.data.taskId;
}

export async function pollImageResult(taskId: string, modelLabel: string, deadline: number) {
  const apiKey = getKieApiKey();

  if (!apiKey) {
    throw new Error(
      "KIE_API_KEY environment variable is not configured. Please add it to .env and try again."
    );
  }

  const intervalMs = 2_000; // 每 2 秒轮询一次

  while (Date.now() < deadline) {
    const res = await fetch(
      `${KIE_API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(
        taskId
      )}`,
      {
        signal: AbortSignal.timeout(Math.max(1, Math.min(10_000, deadline - Date.now()))),
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`${modelLabel} recordInfo returned error:`, text);
      throw new ProviderGenerationError(text || res.statusText, res.status);
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
      throw new ProviderGenerationError(
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
      throw new ProviderGenerationError(
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

