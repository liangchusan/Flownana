export type GenerationErrorCode =
  | "auth_required"
  | "prompt_required"
  | "input_image_required"
  | "unsupported_file_type"
  | "file_too_large"
  | "invalid_image"
  | "invalid_parameters"
  | "content_policy"
  | "insufficient_credits"
  | "credit_conflict"
  | "provider_unavailable"
  | "rate_limited"
  | "timeout"
  | "network_error"
  | "media_processing_failed"
  | "task_not_found"
  | "generation_failed";

export type GenerationMediaType = "image" | "video";

export interface GenerationErrorDisplay {
  code: GenerationErrorCode;
  title: string;
  message: string;
  action: string;
  retryable: boolean;
}

export interface GenerationErrorContext {
  mediaType?: GenerationMediaType;
  source?: "app" | "provider";
  status?: number;
}

export interface GenerationErrorPayload {
  error: string;
  errorCode: GenerationErrorCode;
  errorTitle: string;
  errorAction: string;
  retryable: boolean;
  creditsRefunded?: boolean;
  refundPending?: boolean;
}

const ERROR_CODES = new Set<GenerationErrorCode>([
  "auth_required",
  "prompt_required",
  "input_image_required",
  "unsupported_file_type",
  "file_too_large",
  "invalid_image",
  "invalid_parameters",
  "content_policy",
  "insufficient_credits",
  "credit_conflict",
  "provider_unavailable",
  "rate_limited",
  "timeout",
  "network_error",
  "media_processing_failed",
  "task_not_found",
  "generation_failed",
]);

export class ProviderGenerationError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderGenerationError";
    this.status = status;
  }
}

export function isGenerationErrorCode(value: unknown): value is GenerationErrorCode {
  return typeof value === "string" && ERROR_CODES.has(value as GenerationErrorCode);
}

function mediaLabel(mediaType?: GenerationMediaType) {
  return mediaType === "video" ? "video" : "image";
}

function displayForCode(
  code: GenerationErrorCode,
  mediaType?: GenerationMediaType
): GenerationErrorDisplay {
  const media = mediaLabel(mediaType);
  const catalog: Record<GenerationErrorCode, GenerationErrorDisplay> = {
    auth_required: {
      code,
      title: "Sign in again",
      message: "Your session has expired, so the generation could not start.",
      action: "Sign in and retry your request.",
      retryable: true,
    },
    prompt_required: {
      code,
      title: "Add a prompt",
      message: `Describe the ${media} you want to create before generating.`,
      action: "Enter a prompt and try again.",
      retryable: false,
    },
    input_image_required: {
      code,
      title: "Upload an image",
      message: "This model needs an input image for this generation mode.",
      action: "Upload a JPG, PNG, or WebP image and try again.",
      retryable: false,
    },
    unsupported_file_type: {
      code,
      title: "Image format not supported",
      message: "The uploaded file is not a supported image format.",
      action: "Upload a JPG, PNG, or WebP image and try again.",
      retryable: false,
    },
    file_too_large: {
      code,
      title: "Image is too large",
      message: "The uploaded image exceeds the model's file-size limit.",
      action: "Use an image smaller than 20 MB and try again.",
      retryable: false,
    },
    invalid_image: {
      code,
      title: "Image could not be used",
      message: "The model could not read this image or its dimensions are unsupported.",
      action: "Upload a clear JPG, PNG, or WebP image at least 400 px wide and tall.",
      retryable: false,
    },
    invalid_parameters: {
      code,
      title: "Settings are not supported",
      message: "The selected model does not support one or more requested settings.",
      action: "Choose another resolution, ratio, duration, or sound option and try again.",
      retryable: false,
    },
    content_policy: {
      code,
      title: "Request blocked by safety policy",
      message:
        "The model blocked this request because the prompt or image may contain sexual, nude, violent, celebrity, or other sensitive content.",
      action: "Remove sensitive details or use a different image, then try again.",
      retryable: false,
    },
    insufficient_credits: {
      code,
      title: "Not enough credits",
      message: "Your Flownana balance is too low for this generation.",
      action: "Add credits or choose a lower-cost option.",
      retryable: false,
    },
    credit_conflict: {
      code,
      title: "Credit balance changed",
      message: "Your balance changed while the generation was starting.",
      action: "Refresh the page and try again.",
      retryable: true,
    },
    provider_unavailable: {
      code,
      title: "Model temporarily unavailable",
      message: "The selected model cannot accept this request right now.",
      action: "Try another model or try again later.",
      retryable: true,
    },
    rate_limited: {
      code,
      title: "Too many requests",
      message: "The model is receiving more requests than it can process right now.",
      action: "Wait a minute and try again.",
      retryable: true,
    },
    timeout: {
      code,
      title: "Generation took too long",
      message: "The model did not finish within the expected time.",
      action: "Check My Creations, then retry if no result appears.",
      retryable: true,
    },
    network_error: {
      code,
      title: "Connection interrupted",
      message: "The request could not reach the generation service.",
      action: "Check your connection and try again.",
      retryable: true,
    },
    media_processing_failed: {
      code,
      title: "Result could not be saved",
      message: `The model returned a ${media}, but Flownana could not save it safely.`,
      action: "Try again. If this continues, contact support.",
      retryable: true,
    },
    task_not_found: {
      code,
      title: "Generation not found",
      message: "This generation task is no longer available.",
      action: "Refresh My Creations and start a new generation if needed.",
      retryable: false,
    },
    generation_failed: {
      code,
      title: "Generation failed",
      message: `The ${media} could not be generated.`,
      action: "Try again or choose another model. If this continues, contact support.",
      retryable: true,
    },
  };

  return catalog[code];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readErrorData(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== "object" || Array.isArray(error)) return null;
  const candidate = error as Record<string, unknown>;
  const response = candidate.response;
  if (response && typeof response === "object" && !Array.isArray(response)) {
    const data = (response as Record<string, unknown>).data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  }
  return candidate;
}

function errorText(error: unknown): string {
  if (typeof error === "string") {
    const trimmed = error.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        return errorText(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  const data = readErrorData(error);
  if (!data) return "";
  return (
    readString(data.error) ||
    readString(data.message) ||
    readString(data.msg) ||
    readString(data.failMsg)
  );
}

function errorStatus(error: unknown, explicit?: number): number | undefined {
  if (explicit) return explicit;
  if (error instanceof ProviderGenerationError && error.status) return error.status;
  if (!error || typeof error !== "object" || Array.isArray(error)) return undefined;
  const response = (error as Record<string, unknown>).response;
  if (!response || typeof response !== "object" || Array.isArray(response)) return undefined;
  const status = (response as Record<string, unknown>).status;
  return typeof status === "number" ? status : undefined;
}

function explicitDisplay(
  error: unknown,
  mediaType?: GenerationMediaType
): GenerationErrorDisplay | null {
  const data = readErrorData(error);
  if (!data || !isGenerationErrorCode(data.errorCode)) return null;

  const preset = displayForCode(data.errorCode, mediaType);
  return {
    ...preset,
    title: readString(data.errorTitle) || preset.title,
    message: readString(data.error) || readString(data.message) || preset.message,
    action: readString(data.errorAction) || preset.action,
    retryable:
      typeof data.retryable === "boolean" ? data.retryable : preset.retryable,
  };
}

export function getGenerationErrorDisplay(
  error: unknown,
  context: GenerationErrorContext = {}
): GenerationErrorDisplay {
  const explicit = explicitDisplay(error, context.mediaType);
  if (explicit) return explicit;

  const text = errorText(error);
  const normalized = text.toLowerCase();
  const status = errorStatus(error, context.status);
  const providerSource =
    context.source === "provider" || error instanceof ProviderGenerationError;

  let code: GenerationErrorCode = "generation_failed";

  if (status === 401 && !providerSource) {
    code = "auth_required";
  } else if (status === 402 && !providerSource) {
    code = "insufficient_credits";
  } else if (status === 409) {
    code = "credit_conflict";
  } else if (normalized.includes("session has expired")) {
    code = "auth_required";
  } else if (
    normalized.includes("content polic") ||
    normalized.includes("safety polic") ||
    normalized.includes("content moderation") ||
    normalized.includes("moderation check failed") ||
    normalized.includes("may violate") ||
    normalized.includes("prompt not allowed") ||
    normalized.includes("policy violation") ||
    normalized.includes("inappropriate content") ||
    normalized.includes("unsafe content") ||
    normalized.includes("nsfw") ||
    normalized.includes("sexual") ||
    normalized.includes("nudity") ||
    text.includes("提示词违规") ||
    text.includes("内容违规") ||
    text.includes("安全策略") ||
    text.includes("色情")
  ) {
    code = "content_policy";
  } else if (
    normalized.includes("file type not supported") ||
    normalized.includes("file type is not supported") ||
    normalized.includes("unsupported file type") ||
    normalized.includes("invalid file type") ||
    normalized.includes("image type is not supported") ||
    normalized.includes("not a supported image format")
  ) {
    code = "unsupported_file_type";
  } else if (
    normalized.includes("file is too large") ||
    normalized.includes("file too large") ||
    normalized.includes("maximum file size") ||
    normalized.includes("exceeds the file size") ||
    normalized.includes("exceeds the model's file-size limit") ||
    normalized.includes("payload too large")
  ) {
    code = "file_too_large";
  } else if (
    normalized.includes("requires an input image") ||
    normalized.includes("image is required") ||
    normalized.includes("image_urls is required") ||
    normalized.includes("first_frame_url is required") ||
    normalized.includes("model needs an input image") ||
    normalized.includes("upload an image")
  ) {
    code = "input_image_required";
  } else if (
    normalized.includes("invalid image") ||
    normalized.includes("input image url is invalid") ||
    normalized.includes("input image url must be") ||
    normalized.includes("image dimensions") ||
    normalized.includes("image resolution") ||
    normalized.includes("shortest side") ||
    normalized.includes("width and height") ||
    normalized.includes("failed to download input image") ||
    normalized.includes("could not read image") ||
    normalized.includes("could not read this image")
  ) {
    code = "invalid_image";
  } else if (
    normalized.includes("unsupported resolution") ||
    normalized.includes("unsupported aspect ratio") ||
    normalized.includes("resolution is not within") ||
    normalized.includes("aspect_ratio") ||
    normalized.includes("invalid duration") ||
    normalized.includes("not within the range of allowed options") ||
    normalized.includes("this field is required") ||
    normalized.includes("invalid parameter") ||
    normalized.includes("model settings") ||
    normalized.includes("does not support one or more requested settings")
  ) {
    code = "invalid_parameters";
  } else if (
    normalized.includes("prompt cannot be empty") ||
    normalized.includes("prompt required") ||
    normalized.includes("describe the image you want") ||
    normalized.includes("describe the video you want")
  ) {
    code = "prompt_required";
  } else if (
    normalized.includes("insufficient credits. required") ||
    normalized.includes("not enough credits") ||
    normalized.includes("flownana balance is too low")
  ) {
    code = "insufficient_credits";
  } else if (
    normalized.includes("credit balance changed") ||
    normalized.includes("credit consumption conflict") ||
    normalized.includes("balance changed while the generation")
  ) {
    code = "credit_conflict";
  } else if (
    status === 429 ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("receiving more requests than it can process")
  ) {
    code = "rate_limited";
  } else if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("took too long") ||
    normalized.includes("did not finish within the expected time")
  ) {
    code = "timeout";
  } else if (
    normalized.includes("network error") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("connection reset") ||
    normalized.includes("connection refused") ||
    normalized.includes("socket hang up") ||
    normalized.includes("could not reach the generation service")
  ) {
    code = "network_error";
  } else if (
    normalized.includes("failed to persist") ||
    normalized.includes("generated media storage is not configured") ||
    normalized.includes("unexpected image content type") ||
    normalized.includes("unexpected video content type") ||
    normalized.includes("failed to save") ||
    normalized.includes("could not save it safely") ||
    normalized.includes("failed to download media") ||
    normalized.includes("did not return results") ||
    normalized.includes("did not return video url") ||
    normalized.includes("generated image url not found") ||
    normalized.includes("parse generation results")
  ) {
    code = "media_processing_failed";
  } else if (
    status === 404 ||
    normalized.includes("generation not found") ||
    normalized.includes("task not found") ||
    normalized.includes("generation task is no longer available")
  ) {
    code = "task_not_found";
  } else if (
    providerSource ||
    status === 502 ||
    status === 503 ||
    normalized === "unauthorized" ||
    normalized.includes("current balance isn") ||
    normalized.includes("please top up to continue") ||
    normalized.includes("api key") ||
    normalized.includes("storage is not configured") ||
    normalized.includes("service unavailable") ||
    normalized.includes("selected model cannot accept this request") ||
    normalized.includes("failed to create generation task") ||
    normalized.includes("failed to create video generation task")
  ) {
    code = "provider_unavailable";
  }

  return displayForCode(code, context.mediaType);
}

export function withGenerationCreditOutcome(
  display: GenerationErrorDisplay,
  outcome: {
    creditsConsumed: boolean;
    creditsRefunded: boolean;
    refundPending: boolean;
  }
): GenerationErrorDisplay {
  if (!outcome.creditsConsumed) return display;
  if (outcome.refundPending) {
    return {
      ...display,
      message: `${display.message} Your credits could not be returned automatically.`,
      action: "Please contact support so we can restore the credits.",
      retryable: false,
    };
  }
  if (outcome.creditsRefunded) {
    return {
      ...display,
      message: `${display.message} Your credits were returned automatically.`,
    };
  }
  return display;
}

export function getGenerationErrorPayload(
  error: unknown,
  context: GenerationErrorContext & {
    creditsRefunded?: boolean;
    refundPending?: boolean;
  } = {}
): GenerationErrorPayload {
  const display = getGenerationErrorDisplay(error, context);
  return {
    error: display.message,
    errorCode: display.code,
    errorTitle: display.title,
    errorAction: display.action,
    retryable: display.retryable,
    ...(context.creditsRefunded ? { creditsRefunded: true } : {}),
    ...(context.refundPending ? { refundPending: true } : {}),
  };
}

export function getGenerationErrorHttpStatus(
  code: GenerationErrorCode,
  fallback = 500
): number {
  switch (code) {
    case "auth_required":
      return 401;
    case "prompt_required":
    case "input_image_required":
    case "unsupported_file_type":
    case "file_too_large":
    case "invalid_image":
    case "invalid_parameters":
      return 400;
    case "content_policy":
      return 422;
    case "insufficient_credits":
      return 402;
    case "credit_conflict":
      return 409;
    case "rate_limited":
      return 429;
    case "provider_unavailable":
      return 503;
    case "timeout":
      return 504;
    case "task_not_found":
      return 404;
    default:
      return fallback;
  }
}
