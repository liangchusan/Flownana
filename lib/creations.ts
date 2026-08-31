import { recoverGenerationObligations, withGenerationAccount } from "@/lib/generation-lifecycle";
import {
  normalizeGenerationParameters,
  type CreationHistoryItem,
} from "@/lib/creation-history";
import { getGenerationErrorDisplay } from "@/lib/generation-errors";
import { restoreCreationInputs } from "@/lib/creation-inputs";

export type CreationType = CreationHistoryItem["type"];

const CREATION_SELECT = {
  id: true,
  type: true,
  status: true,
  urls: true,
  inputUrls: true,
  prompt: true,
  createdAt: true,
  taskId: true,
  error: true,
  modelOptionId: true,
  creditsCost: true,
  parameters: true,
  media: {
    where: { role: "input" },
    orderBy: { position: "asc" },
    select: { mediaAsset: { select: { url: true, type: true } } },
  },
} as const;

function toCreationHistoryItem(creation: {
  id: string;
  type: string;
  status: string;
  urls: string[];
  inputUrls: string[];
  prompt: string;
  createdAt: Date;
  taskId: string | null;
  error: string | null;
  modelOptionId: string | null;
  creditsCost: number | null;
  parameters: unknown;
  media: Array<{ mediaAsset: { url: string; type: string } }>;
}): CreationHistoryItem {
  const inputs = restoreCreationInputs(creation.inputUrls, creation.media);
  const parameters = normalizeGenerationParameters(creation.parameters);
  const refundPending = !!creation.parameters && typeof creation.parameters === "object" &&
    "creditOutcome" in creation.parameters && creation.parameters.creditOutcome === "pending";
  return {
    id: creation.id,
    type: creation.type as CreationType,
    status: creation.status as CreationHistoryItem["status"],
    urls: creation.urls,
    inputUrls: inputs.inputUrls,
    prompt: creation.prompt,
    createdAt: creation.createdAt.toISOString(),
    taskId: creation.taskId ?? undefined,
    error: creation.error ? `${creation.error}${refundPending ? " Please contact support so we can restore the credits." : ""}` : undefined,
    errorCode: creation.error
      ? getGenerationErrorDisplay(creation.error, {
          mediaType: creation.type === "video" ? "video" : "image",
        }).code
      : undefined,
    modelOptionId: creation.modelOptionId ?? undefined,
    creditsCost: creation.creditsCost ?? undefined,
    parameters: inputs.inputKinds ? { ...parameters, inputKinds: inputs.inputKinds } : parameters,
  };
}

export async function getCreationHistory(params: {
  userId: string;
  accountCreatedAt?: string;
  type?: CreationType;
  take?: number;
}): Promise<CreationHistoryItem[]> {
  const where = params.type
    ? { userId: params.userId, type: params.type }
    : { userId: params.userId };

  const account = { id: params.userId, accountCreatedAt: params.accountCreatedAt };
  await recoverGenerationObligations(account);
  const creations = await withGenerationAccount(account, (tx) => tx.generation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: params.take ?? 100,
    select: CREATION_SELECT,
  }));

  return creations.map(toCreationHistoryItem);
}
