import { Prisma, type Generation } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { ACTIVE_GENERATION_STATUSES } from "@/lib/account-profile";
import {
  consumeCreditsFIFOWithClient, readCreditConsumptionSnapshot, refundConsumedCreditsWithClient,
} from "@/lib/credit-consumption";
import { syncGenerationMediaAssets, type GenerationMediaAsset } from "@/lib/media-assets";
import {
  getGenerationErrorDisplay, withGenerationCreditOutcome, type GenerationErrorCode,
} from "@/lib/generation-errors";

export const MAX_ACTIVE_OUTPUTS = 5;
export const IMAGE_TASK_TIMEOUT_MS = 5 * 60_000;
export const VIDEO_TASK_TIMEOUT_MS = 45 * 60_000;
const OUTPUT_STORAGE_LEASE_MS = 5 * 60_000;
export type GenerationAccount = { id: string; accountCreatedAt?: string };

export class GenerationRequestError extends Error {
  errorCode: GenerationErrorCode;
  constructor(code: GenerationErrorCode) {
    super(getGenerationErrorDisplay({ errorCode: code }).message);
    this.name = "GenerationRequestError";
    this.errorCode = code;
  }
}

export function generationParameters(value: unknown): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue> : {};
}

export function isActiveGeneration(status: string): boolean {
  return (ACTIVE_GENERATION_STATUSES as readonly string[]).includes(status);
}

type OutputStorageLease = { id: string; expiresAt: number; pathname?: string };

function outputStorageLease(parameters: unknown): OutputStorageLease | null {
  const value = generationParameters(parameters).outputStorage;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return typeof value.id === "string" && typeof value.expiresAt === "number"
    ? value as OutputStorageLease : null;
}

export function hasActiveOutputStorage(parameters: unknown): boolean {
  return (outputStorageLease(parameters)?.expiresAt ?? 0) > Date.now();
}

function isOutputPath(userId: string, value: unknown): value is string {
  const segment = userId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96) || "unknown";
  return typeof value === "string" && value.startsWith(`generations/${segment}/`) &&
    /^generations\/[a-zA-Z0-9_-]+\/(image|video|music)\/[a-zA-Z0-9_.-]+$/.test(value);
}

export function getPendingGenerationOutputPaths(userId: string, parameters: unknown): string[] {
  const saved = generationParameters(parameters);
  const paths = Array.isArray(saved.pendingOutputCleanup) ? saved.pendingOutputCleanup : [];
  return [...new Set([...paths, outputStorageLease(parameters)?.pathname].filter((path) => isOutputPath(userId, path)))];
}

/** Same physical User lock as billing. Always lock User before Generation. */
export async function withGenerationAccount<T>(
  account: GenerationAccount, run: (tx: Prisma.TransactionClient) => Promise<T>, timeout = 15_000
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${account.id} FOR UPDATE`;
    const current = await tx.user.findUnique({ where: { id: account.id }, select: { createdAt: true } });
    if (!current || (account.accountCreatedAt && current.createdAt.toISOString() !== account.accountCreatedAt)) {
      throw new GenerationRequestError("auth_required");
    }
    return run(tx);
  }, { maxWait: 5_000, timeout });
}

async function lockGeneration(tx: Prisma.TransactionClient, account: GenerationAccount, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Generation" WHERE "id" = ${id} AND "userId" = ${account.id} FOR UPDATE`;
  const generation = await tx.generation.findFirst({ where: { id, userId: account.id } });
  if (!generation) throw new GenerationRequestError("task_not_found");
  return generation;
}

function generationConsumption(generation: Generation) {
  const consumed = readCreditConsumptionSnapshot(generation.creditConsumption);
  if (consumed.length && generation.creditsCost !== null &&
    consumed.reduce((sum, item) => sum + item.amount, 0) !== generation.creditsCost) {
    throw new Error("Stored credit consumption does not match generation cost");
  }
  return consumed;
}

export async function reserveGeneration(params: {
  account: { id: string; accountCreatedAt: string };
  type: "image" | "video"; prompt: string; modelOptionId: string;
  creditsCost: number; parameters: Prisma.InputJsonObject; inputs: GenerationMediaAsset[];
}): Promise<Generation> {
  return withGenerationAccount(params.account, async (tx) => {
    const active = await tx.generation.count({ where: {
      userId: params.account.id, type: { in: ["image", "video"] },
      status: { in: [...ACTIVE_GENERATION_STATUSES] },
    } });
    if (active >= MAX_ACTIVE_OUTPUTS) throw new GenerationRequestError("rate_limited");
    // Recheck ownership under the same lock as media deletion, not just before
    // an awaited upload/metadata operation. Never recreate a deleted input.
    for (const input of params.inputs) {
      const owned = await tx.mediaAsset.findUnique({ where: {
        userId_url: { userId: params.account.id, url: input.media.url },
      } });
      if (!owned || owned.type !== input.type || input.role !== "input") {
        throw new GenerationRequestError("invalid_image");
      }
    }
    const consumed = await consumeCreditsFIFOWithClient(tx, params.account.id, params.creditsCost);
    const generation = await tx.generation.create({ data: {
      userId: params.account.id, type: params.type, status: "pending", prompt: params.prompt,
      modelOptionId: params.modelOptionId, parameters: params.parameters,
      inputUrls: params.inputs.map((input) => input.media.url), creditsCost: params.creditsCost,
      creditConsumption: consumed as Prisma.InputJsonValue,
    } });
    await syncGenerationMediaAssets({ generationId: generation.id, userId: params.account.id, assets: params.inputs, tx });
    return generation;
  });
}

export async function attachGenerationTask(account: GenerationAccount, id: string, taskId: string) {
  return withGenerationAccount(account, async (tx) => {
    const current = await lockGeneration(tx, account, id);
    if (current.status !== "pending") return current;
    if (!taskId || (current.taskId && current.taskId !== taskId)) throw new Error("Generation task mismatch");
    return tx.generation.update({ where: { id }, data: { taskId, status: "generating" } });
  });
}

/** Share an expiring storage lease across instances; never hold a DB transaction during network IO. */
export async function claimGenerationOutput(account: GenerationAccount, id: string) {
  return withGenerationAccount(account, async (tx) => {
    const current = await lockGeneration(tx, account, id);
    if (!isActiveGeneration(current.status) || hasActiveOutputStorage(current.parameters)) {
      return { generation: current, attemptId: null };
    }
    const attemptId = randomUUID();
    const generation = await tx.generation.update({ where: { id }, data: {
      parameters: { ...generationParameters(current.parameters),
        pendingOutputCleanup: getPendingGenerationOutputPaths(account.id, current.parameters),
        outputStorage: { id: attemptId, expiresAt: Date.now() + OUTPUT_STORAGE_LEASE_MS } },
    } });
    return { generation, attemptId };
  });
}

/** Persist the exact pathname BEFORE Blob put, including uploads whose response is lost. */
export async function recordGenerationOutputPath(account: GenerationAccount, id: string, attemptId: string, pathname: string) {
  if (!isOutputPath(account.id, pathname)) throw new Error("Invalid generated media pathname");
  return withGenerationAccount(account, async (tx) => {
    const current = await lockGeneration(tx, account, id);
    const lease = outputStorageLease(current.parameters);
    if (!isActiveGeneration(current.status) || lease?.id !== attemptId || lease.expiresAt <= Date.now()) {
      throw new GenerationRequestError("timeout");
    }
    await tx.generation.update({ where: { id }, data: {
      parameters: { ...generationParameters(current.parameters), outputStorage: { ...lease, pathname } },
    } });
  });
}

/** Revoke expired attempts before external cleanup so a late worker cannot publish a deleted file. */
export async function recoverGenerationOutputCleanup(account: GenerationAccount, generationId?: string) {
  const cleanup = await withGenerationAccount(account, async (tx) => {
    const candidates = await tx.generation.findMany({ where: { userId: account.id,
      ...(generationId ? { id: generationId } : {}), OR: [
        { parameters: { path: ["outputStorage"], not: Prisma.AnyNull } },
        { parameters: { path: ["pendingOutputCleanup"], not: Prisma.AnyNull } },
      ],
    }, take: 20, orderBy: { updatedAt: "asc" } });
    const items: Array<{ id: string; paths: string[] }> = [];
    for (const current of candidates) {
      const saved = generationParameters(current.parameters);
      const lease = outputStorageLease(saved);
      const pending = getPendingGenerationOutputPaths(account.id, saved).filter((path) =>
        !(lease && lease.expiresAt > Date.now() && path === lease.pathname));
      const { outputStorage: _lease, pendingOutputCleanup: _pending, ...rest } = saved;
      await tx.generation.update({ where: { id: current.id }, data: { parameters: {
        ...rest, ...(lease && lease.expiresAt > Date.now() ? { outputStorage: lease } : {}),
        ...(pending.length ? { pendingOutputCleanup: pending } : {}),
      } } });
      if (pending.length) items.push({ id: current.id, paths: pending });
    }
    return items;
  });
  if (!cleanup.length) return;
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Media cleanup is not configured");
    await del([...new Set(cleanup.flatMap((item) => item.paths))], { abortSignal: AbortSignal.timeout(15_000) });
  } catch (error) {
    console.error("Generated output cleanup remains pending:", error);
    return;
  }
  await withGenerationAccount(account, async (tx) => {
    for (const item of cleanup) {
      const current = await tx.generation.findFirst({ where: { id: item.id, userId: account.id } });
      if (!current) continue;
      const saved = generationParameters(current.parameters);
      const pending = (Array.isArray(saved.pendingOutputCleanup) ? saved.pendingOutputCleanup : []).filter((path) =>
        typeof path === "string" && !item.paths.includes(path));
      const { pendingOutputCleanup: _pending, ...rest } = saved;
      await tx.generation.update({ where: { id: current.id }, data: {
        parameters: { ...rest, ...(pending.length ? { pendingOutputCleanup: pending } : {}) },
      } });
    }
  });
}

/** Called only after this worker's upload has ended; otherwise wait for the full lease to expire. */
export async function finishGenerationOutputAttempt(account: GenerationAccount, id: string, attemptId: string, uploadAcknowledged = false) {
  try {
    await withGenerationAccount(account, async (tx) => {
      const current = await tx.generation.findFirst({ where: { id, userId: account.id } });
      const lease = outputStorageLease(current?.parameters);
      if (!current || !lease || lease.id !== attemptId || isActiveGeneration(current.status)) return;
      // An aborted/lost put response does not prove the remote upload stopped.
      // Keep its grace period before deleting the pre-recorded pathname.
      if (lease.pathname && !uploadAcknowledged) return;
      await tx.generation.update({ where: { id }, data: {
        parameters: { ...generationParameters(current.parameters), outputStorage: { ...lease, expiresAt: 0 } },
      } });
    });
    await recoverGenerationOutputCleanup(account, id);
  } catch (error) {
    console.error("Generated output cleanup will retry on history access:", error);
  }
}

export async function completeGeneration(params: {
  account: GenerationAccount; id: string; output: GenerationMediaAsset; attemptId?: string;
}) {
  return withGenerationAccount(params.account, async (tx) => {
    const current = await lockGeneration(tx, params.account, params.id);
    if (!isActiveGeneration(current.status)) return { generation: current, accepted: false };
    const lease = outputStorageLease(current.parameters);
    if (params.attemptId && (lease?.id !== params.attemptId || lease.expiresAt <= Date.now())) {
      return { generation: current, accepted: false };
    }
    if (params.attemptId && (!lease?.pathname || lease.pathname !== params.output.media.pathname ||
      !params.output.media.url.endsWith(`/${lease.pathname}`))) throw new Error("Generated output does not match its storage intent");
    generationConsumption(current);
    if (params.output.role !== "output" || params.output.type !== current.type) {
      throw new GenerationRequestError("invalid_parameters");
    }
    await syncGenerationMediaAssets({ generationId: current.id, userId: current.userId, assets: [params.output], tx });
    const { outputStorage: _lease, ...saved } = generationParameters(current.parameters);
    const generation = await tx.generation.update({ where: { id: current.id }, data: {
      status: "success", urls: [params.output.media.url], error: null, creditConsumption: Prisma.JsonNull,
      parameters: { ...saved,
        processingDurationMs: Math.max(0, Date.now() - current.createdAt.getTime()) },
    } });
    return { generation, accepted: true };
  });
}

export type GenerationFailureSettlement = {
  generation: Generation; creditsRefunded: boolean; refundPending: boolean;
};

export async function failGeneration(params: {
  account: GenerationAccount; id: string; error: unknown; source?: "app" | "provider"; attemptId?: string;
}): Promise<GenerationFailureSettlement> {
  const settle = (refund: boolean) => withGenerationAccount(params.account, async (tx) => {
    const current = await lockGeneration(tx, params.account, params.id);
    const saved = generationParameters(current.parameters);
    if (params.attemptId && isActiveGeneration(current.status) && outputStorageLease(saved)?.id !== params.attemptId) {
      return { generation: current, creditsRefunded: false, refundPending: false };
    }
    if (current.status === "success" || current.status === "deleted") {
      return { generation: current, creditsRefunded: false, refundPending: false };
    }
    const obligationExists = current.creditConsumption !== null &&
      !(Array.isArray(current.creditConsumption) && current.creditConsumption.length === 0);
    let creditsRefunded = saved.creditOutcome === "refunded";
    if (refund) {
      const consumed = generationConsumption(current);
      if (consumed.length) {
        await refundConsumedCreditsWithClient(tx, consumed, current.userId);
        creditsRefunded = true;
      }
    }
    const refundPending = !refund && obligationExists;
    const display = withGenerationCreditOutcome(
      getGenerationErrorDisplay(params.error, { mediaType: current.type === "video" ? "video" : "image", source: params.source }),
      { creditsConsumed: obligationExists || creditsRefunded, creditsRefunded, refundPending }
    );
    const generation = await tx.generation.update({ where: { id: current.id }, data: {
      status: "failed", error: display.message,
      ...(refund ? { creditConsumption: Prisma.JsonNull } : {}),
      parameters: { ...saved, processingDurationMs: Math.max(0, Date.now() - current.createdAt.getTime()),
        creditOutcome: refundPending ? "pending" : creditsRefunded ? "refunded" : "not_charged" },
    } });
    return { generation, creditsRefunded, refundPending };
  });
  try {
    return await settle(true);
  } catch (error) {
    if (error instanceof GenerationRequestError) throw error;
    // Keep the original snapshot and a failed state so later recovery can retry.
    // A concurrent success/deletion is re-read under the same locks.
    console.error("Generation refund settlement failed; preserving obligation:", error);
    return settle(false);
  }
}

export async function recoverFailedGenerations(account: GenerationAccount) {
  const failed = await prisma.generation.findMany({ where: {
    userId: account.id, status: "failed", creditConsumption: { not: Prisma.AnyNull },
  }, take: 20, orderBy: { updatedAt: "asc" } });
  for (const generation of failed) {
    await failGeneration({ account, id: generation.id, error: generation.error || { errorCode: "generation_failed" } });
  }
}

export async function recoverGenerationObligations(account: GenerationAccount) {
  const now = Date.now();
  const expired = await prisma.generation.findMany({ where: {
    userId: account.id, status: { in: [...ACTIVE_GENERATION_STATUSES] },
    OR: [
      { type: "image", createdAt: { lte: new Date(now - IMAGE_TASK_TIMEOUT_MS) } },
      { type: "video", createdAt: { lte: new Date(now - VIDEO_TASK_TIMEOUT_MS) } },
    ],
  }, take: 20, orderBy: { createdAt: "asc" } });
  for (const generation of expired) {
    await failGeneration({ account, id: generation.id, error: { errorCode: "timeout" } });
  }
  await recoverFailedGenerations(account);
  await recoverGenerationOutputCleanup(account);
}
