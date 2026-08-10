import assert from "node:assert/strict";
import test from "node:test";
import {
  ProviderGenerationError,
  type GenerationErrorCode,
  getGenerationErrorDisplay,
  getGenerationErrorHttpStatus,
  getGenerationErrorPayload,
  withGenerationCreditOutcome,
} from "../lib/generation-errors.ts";

const ALL_ERROR_CODES: GenerationErrorCode[] = [
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
];

test("content policy errors cover image and video provider wording", () => {
  for (const message of [
    "We’re so sorry, but the prompt may violate OpenAI’s content policies.",
    "Content moderation check failed: sexual",
    "Inappropriate content, please try another prompt.",
  ]) {
    const display = getGenerationErrorDisplay(message, { mediaType: "video" });
    assert.equal(display.code, "content_policy");
    assert.equal(display.title, "Request blocked by safety policy");
    assert.match(display.action, /remove sensitive/i);
    assert.equal(display.retryable, false);
  }
});

test("upload failures distinguish format, size, missing input, and bad images", () => {
  assert.equal(
    getGenerationErrorDisplay("Input image file type is not supported: image/tiff").code,
    "unsupported_file_type"
  );
  assert.equal(
    getGenerationErrorDisplay("Input image exceeds the maximum file size of 20 MB.").code,
    "file_too_large"
  );
  assert.equal(
    getGenerationErrorDisplay("Grok requires an input image. Upload an image and try again.").code,
    "input_image_required"
  );
  assert.equal(
    getGenerationErrorDisplay("Input image URL is invalid.").code,
    "invalid_image"
  );
});

test("provider schema errors become settings guidance", () => {
  for (const message of [
    "resolution is not within the range of allowed options",
    "This field is required",
    "Unsupported aspect ratio for this resolution.",
  ]) {
    const display = getGenerationErrorDisplay(message, { mediaType: "video" });
    assert.equal(display.code, "invalid_parameters");
    assert.match(display.action, /resolution, ratio, duration/i);
  }
});

test("provider balance and authentication never tell the Flownana user to top up KIE", () => {
  for (const error of [
    new ProviderGenerationError(
      "Credits insufficient : Your current balance isn’t enough to run this request. Please top up to continue."
    ),
    new ProviderGenerationError("Unauthorized", 401),
  ]) {
    const display = getGenerationErrorDisplay(error, {
      source: "provider",
      mediaType: "video",
    });
    assert.equal(display.code, "provider_unavailable");
    assert.doesNotMatch(display.message, /credits|top up|unauthorized/i);
    assert.match(display.action, /another model|later/i);
  }
});

test("user session and user credits use account-specific guidance", () => {
  assert.equal(
    getGenerationErrorDisplay({ response: { status: 401, data: {} } }).code,
    "auth_required"
  );
  assert.equal(
    getGenerationErrorDisplay({ response: { status: 402, data: {} } }).code,
    "insufficient_credits"
  );
});

test("rate limit, timeout, and network errors are retryable", () => {
  const cases = [
    [{ response: { status: 429, data: {} } }, "rate_limited"],
    ["Provider timed out", "timeout"],
    ["Network Error", "network_error"],
  ] as const;

  for (const [error, code] of cases) {
    const display = getGenerationErrorDisplay(error);
    assert.equal(display.code, code);
    assert.equal(display.retryable, true);
  }
});

test("media persistence failures do not expose storage details", () => {
  const display = getGenerationErrorDisplay(
    "Failed to persist generated media to Vercel Blob",
    { mediaType: "image" }
  );
  assert.equal(display.code, "media_processing_failed");
  assert.doesNotMatch(display.message, /Vercel|Blob/i);
});

test("explicit API payload stays stable on the client", () => {
  const display = getGenerationErrorDisplay({
    errorCode: "insufficient_credits",
    errorTitle: "Not enough credits",
    error: "This generation needs 22 credits, but you have 10.",
    errorAction: "Choose a lower-cost option.",
    retryable: false,
  });

  assert.equal(display.code, "insufficient_credits");
  assert.equal(display.message, "This generation needs 22 credits, but you have 10.");
  assert.equal(display.action, "Choose a lower-cost option.");
});

test("refunded and pending credit outcomes are explicit", () => {
  const base = getGenerationErrorDisplay("Content moderation check failed: sexual");
  const refunded = withGenerationCreditOutcome(base, {
    creditsConsumed: true,
    creditsRefunded: true,
    refundPending: false,
  });
  assert.match(refunded.message, /returned automatically/i);

  const pending = withGenerationCreditOutcome(base, {
    creditsConsumed: true,
    creditsRefunded: false,
    refundPending: true,
  });
  assert.match(pending.message, /could not be returned automatically/i);
  assert.match(pending.action, /contact support/i);
  assert.equal(pending.retryable, false);
});

test("API payload and status are derived from the shared catalog", () => {
  const payload = getGenerationErrorPayload(
    { errorCode: "content_policy" },
    { mediaType: "image", creditsRefunded: true }
  );
  assert.equal(payload.errorCode, "content_policy");
  assert.equal(payload.creditsRefunded, true);
  assert.equal(getGenerationErrorHttpStatus(payload.errorCode), 422);
  assert.equal(getGenerationErrorHttpStatus("provider_unavailable"), 503);
});

test("persisted catalog messages keep their original classification", () => {
  for (const code of ALL_ERROR_CODES) {
    const original = getGenerationErrorDisplay({ errorCode: code }, { mediaType: "video" });
    const restored = getGenerationErrorDisplay(original.message, { mediaType: "video" });
    assert.equal(restored.code, code, `${code} should survive history persistence`);
  }
});
