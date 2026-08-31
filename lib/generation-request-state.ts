import { isGenerationErrorCode } from "@/lib/generation-errors";
import { isAccountOperationCancelled } from "@/lib/account-operation";
import type { GenerationParameters } from "@/lib/creation-history";

export const GENERATION_STATUS_UNAVAILABLE = "We could not confirm the generation status. Check your creation history before retrying; the request may still be processing.";

/** An HTTP failure is not evidence that an already accepted generation failed. */
export function isConfirmedGenerationFailure(error: unknown, accepted = false): boolean {
  const response = (error as { response?: { data?: Record<string, unknown>; status?: number } })?.response;
  const data = response?.data;
  if (!data || !isGenerationErrorCode(data.errorCode)) return false;
  if (accepted) return data.status === "failed" && typeof data.generationId === "string";
  return data.status === "failed" || (!!response?.status && response.status >= 400 && response.status < 500);
}

export class GenerationStatusUnavailableError extends Error {
  constructor() { super(GENERATION_STATUS_UNAVAILABLE); }
}

/** Retry only the read, never a paid POST. Exhaustion leaves the outcome unknown. */
interface GenerationPollData {
  pending?: boolean;
  success?: boolean;
  videoUrl?: string;
  status?: string;
  taskId?: string;
  modelOptionId?: string;
  prompt?: string;
  creditsCost?: number;
  parameters?: GenerationParameters;
  inputUrls?: string[];
}

export async function pollGenerationResult(options: {
  read: () => Promise<{ data: GenerationPollData }>;
  assertCurrent: () => void;
  wait: (ms: number) => Promise<void>;
  maxAttempts?: number;
}): Promise<GenerationPollData & { videoUrl: string }> {
  for (let attempt = 0; attempt < (options.maxAttempts ?? 360); attempt++) {
    await options.wait(attempt === 0 ? 2000 : 8000);
    options.assertCurrent();
    try {
      const { data } = await options.read();
      options.assertCurrent();
      if (data.pending) continue;
      if (data.success && data.videoUrl) return { ...data, videoUrl: data.videoUrl };
      if (data.status === "failed") throw { response: { data } };
      if (data.status === "deleted") throw new GenerationStatusUnavailableError();
    } catch (error) {
      if (isAccountOperationCancelled(error)) throw error;
      options.assertCurrent();
      if (isConfirmedGenerationFailure(error, true)) throw error;
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403 || status === 404 || error instanceof GenerationStatusUnavailableError) {
        throw new GenerationStatusUnavailableError();
      }
    }
  }
  throw new GenerationStatusUnavailableError();
}
