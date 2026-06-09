export type KieVideoResultData = {
  status?: string;
  state?: string;
  successFlag?: number;
  videoUrl?: string;
  resultUrl?: string;
  outputUrl?: string;
  resultUrls?: string[] | string | null;
  resultJson?: string | null;
  response?: {
    videoUrl?: string;
    resultUrl?: string;
    outputUrl?: string;
    resultUrls?: string[] | string | null;
    videos?: Array<{ url?: string }>;
  } | null;
  failMsg?: string | null;
  error?: string;
  errorMessage?: string | null;
};

export type ParsedKieVideoResult =
  | { state: "pending" }
  | { state: "failed"; error: string }
  | { state: "success"; url: string };

function firstString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function parseUrlList(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value.find((item) => firstString(item));
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const directUrl = firstString(value);
  if (directUrl?.startsWith("http")) {
    return directUrl;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parseUrlList(parsed);
  } catch {
    return undefined;
  }
}

function extractVideoUrl(data: KieVideoResultData): string | undefined {
  const directUrl =
    firstString(data.videoUrl) ||
    firstString(data.resultUrl) ||
    firstString(data.outputUrl) ||
    parseUrlList(data.resultUrls) ||
    firstString(data.response?.videoUrl) ||
    firstString(data.response?.resultUrl) ||
    firstString(data.response?.outputUrl) ||
    parseUrlList(data.response?.resultUrls) ||
    firstString(data.response?.videos?.[0]?.url);

  if (directUrl) {
    return directUrl;
  }

  if (!data.resultJson) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(data.resultJson) as {
      videoUrl?: string;
      resultUrl?: string;
      outputUrl?: string;
      resultUrls?: string[] | string;
      videos?: Array<{ url?: string }>;
    };
    return (
      firstString(parsed.videoUrl) ||
      firstString(parsed.resultUrl) ||
      firstString(parsed.outputUrl) ||
      parseUrlList(parsed.resultUrls) ||
      firstString(parsed.videos?.[0]?.url)
    );
  } catch {
    return undefined;
  }
}

export function parseKieVideoResult(
  data: KieVideoResultData
): ParsedKieVideoResult {
  if (data.successFlag === 0) {
    return { state: "pending" };
  }

  if (data.successFlag === 2 || data.successFlag === 3) {
    return {
      state: "failed",
      error:
        data.error ||
        data.errorMessage ||
        data.failMsg ||
        "Video generation failed. Please try again later.",
    };
  }

  const rawStatus = data.status || data.state || "";
  const status = rawStatus.toLowerCase();

  if (status === "processing" || status === "waiting" || status === "pending") {
    return { state: "pending" };
  }

  if (status === "failed" || status === "fail") {
    return {
      state: "failed",
      error:
        data.error ||
        data.errorMessage ||
        data.failMsg ||
        "Video generation failed. Please try again later.",
    };
  }

  if (data.successFlag === 1 || status === "completed" || status === "success") {
    const url = extractVideoUrl(data);
    if (url) {
      return { state: "success", url };
    }
    return {
      state: "failed",
      error: "Task succeeded but did not return video URL. Please try again later.",
    };
  }

  return { state: "pending" };
}
