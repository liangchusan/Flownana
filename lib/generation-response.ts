import { NextResponse } from "next/server";
import type { Generation } from "@prisma/client";
import { CreditConsumptionConflictError, InsufficientCreditsError } from "@/lib/credit-consumption";
import {
  ProviderGenerationError, getGenerationErrorDisplay, getGenerationErrorHttpStatus,
  getGenerationErrorPayload, withGenerationCreditOutcome,
} from "@/lib/generation-errors";
import { GenerationRequestError, generationParameters, isActiveGeneration } from "@/lib/generation-lifecycle";

export function generationUncertainResponse(extra: { taskId?: string; generationId?: string } = {}) {
  // A failed database acknowledgement cannot establish either terminal state
  // or a refund obligation. History will re-read the authoritative outcome.
  return NextResponse.json({ success: false, pending: true, status: "unknown", ...extra,
    error: "We could not confirm the generation status. Check your creation history before retrying; the request may still be processing.",
  }, { status: 503 });
}

export function generationErrorResponse(
  error: unknown, type: "image" | "video",
  extra: { taskId?: string; generationId?: string; refundPending?: boolean; creditsRefunded?: boolean } = {},
  reservationAttempted = false
) {
  if (reservationAttempted && !(error instanceof GenerationRequestError ||
    error instanceof InsufficientCreditsError || error instanceof CreditConsumptionConflictError)) {
    return generationUncertainResponse();
  }
  const mapped = error instanceof InsufficientCreditsError ? {
    errorCode: "insufficient_credits",
    error: `This generation needs ${error.required} credits, but you have ${error.available}.`,
  } : error instanceof CreditConsumptionConflictError ? { errorCode: "credit_conflict" } : error;
  const display = withGenerationCreditOutcome(getGenerationErrorDisplay(mapped, {
    mediaType: type, source: error instanceof ProviderGenerationError ? "provider" : "app",
  }), { creditsConsumed: !!extra.refundPending || !!extra.creditsRefunded,
    creditsRefunded: !!extra.creditsRefunded, refundPending: !!extra.refundPending });
  const payload = getGenerationErrorPayload({ errorCode: display.code, error: display.message }, {
    mediaType: type, creditsRefunded: extra.creditsRefunded, refundPending: extra.refundPending,
  });
  return NextResponse.json({ success: false, pending: false, status: "failed", ...payload, ...extra,
    ...(error instanceof InsufficientCreditsError ? { required: error.required, available: error.available } : {}),
  }, { status: getGenerationErrorHttpStatus(display.code) });
}

export function generationResponse(generation: Generation) {
  const type = generation.type === "video" ? "video" : "image";
  const common = { id: generation.id, generationId: generation.id, prompt: generation.prompt,
    taskId: generation.taskId || generation.id, creditsCost: generation.creditsCost,
    modelOptionId: generation.modelOptionId, parameters: generation.parameters, inputUrls: generation.inputUrls };
  if (generation.status === "success") {
    return NextResponse.json({ ...common, success: true, pending: false, status: "success",
      ...(type === "image" ? { imageUrl: generation.urls[0] } : { videoUrl: generation.urls[0] }) });
  }
  if (isActiveGeneration(generation.status)) {
    return NextResponse.json({ ...common, success: true, pending: true, status: generation.status });
  }
  if (generation.status === "deleted") {
    return NextResponse.json({ ...common, success: false, pending: false, status: "deleted" });
  }
  const outcome = generationParameters(generation.parameters).creditOutcome;
  const display = getGenerationErrorDisplay(generation.error || { errorCode: "generation_failed" }, { mediaType: type });
  const payload = getGenerationErrorPayload({ errorCode: display.code, error: generation.error || display.message }, {
    mediaType: type, creditsRefunded: outcome === "refunded", refundPending: outcome === "pending",
  });
  return NextResponse.json({ ...common, success: false, pending: false, status: "failed", ...payload },
    { status: getGenerationErrorHttpStatus(display.code) });
}
