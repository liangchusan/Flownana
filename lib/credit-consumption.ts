import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  planCreditConsumption,
  sumRemainingCredits,
} from "@/lib/credit-consumption-plan";

export class InsufficientCreditsError extends Error {
  constructor(public required: number, public available: number) {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

export class CreditConsumptionConflictError extends Error {
  constructor() {
    super("Credit consumption conflict. Please retry.");
    this.name = "CreditConsumptionConflictError";
  }
}

export type CreditConsumptionSnapshot = {
  batchId: string;
  amount: number;
}[];

/** A malformed durable obligation must never be partially refunded and erased. */
export function readCreditConsumptionSnapshot(value: unknown): CreditConsumptionSnapshot {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Invalid stored credit consumption");
  const seen = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== "object" || typeof item.batchId !== "string" || !item.batchId ||
      !Number.isSafeInteger(item.amount) || item.amount <= 0 || seen.has(item.batchId)) {
      throw new Error("Invalid stored credit consumption");
    }
    seen.add(item.batchId);
    return { batchId: item.batchId, amount: item.amount };
  });
}

/** Caller holds the User lock; debit and reservation share the same commit. */
export async function consumeCreditsFIFOWithClient(
  tx: Prisma.TransactionClient, userId: string, amount: number
): Promise<CreditConsumptionSnapshot> {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid credit cost");
  const batches = await tx.creditBatch.findMany({
    where: { userId, remaining: { gt: 0 }, expiresAt: { gt: new Date() } },
    orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
  });
  const available = sumRemainingCredits(batches);
  if (available < amount) throw new InsufficientCreditsError(amount, available);
  const consumed = planCreditConsumption(batches, amount);
  for (const item of consumed) {
    const changed = await tx.creditBatch.updateMany({
      where: { id: item.batchId, userId, remaining: { gte: item.amount } },
      data: { remaining: { decrement: item.amount } },
    });
    if (changed.count !== 1) throw new CreditConsumptionConflictError();
  }
  return consumed;
}

export async function consumeCreditsFIFO(
  userId: string,
  amount: number
): Promise<CreditConsumptionSnapshot> {
  if (amount <= 0) {
    return [];
  }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const now = new Date();
    const batches = await prisma.creditBatch.findMany({
      where: {
        userId,
        remaining: { gt: 0 },
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: "asc" },
    });

    const available = sumRemainingCredits(batches);
    if (available < amount) {
      throw new InsufficientCreditsError(amount, available);
    }

    const consumed = planCreditConsumption(batches, amount);

    try {
      await prisma.$transaction(async (tx) => {
        for (const item of consumed) {
          const updated = await tx.creditBatch.updateMany({
            where: {
              id: item.batchId,
              remaining: { gte: item.amount },
            },
            data: {
              remaining: { decrement: item.amount },
            },
          });

          if (updated.count !== 1) {
            throw new CreditConsumptionConflictError();
          }
        }
      });
      return consumed;
    } catch (error) {
      if (
        error instanceof CreditConsumptionConflictError &&
        attempt < maxAttempts
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new CreditConsumptionConflictError();
}

export async function refundConsumedCredits(
  consumed: CreditConsumptionSnapshot
): Promise<void> {
  if (!consumed.length) return;

  await prisma.$transaction(async (tx) => {
    await refundConsumedCreditsWithClient(tx, consumed);
  });
}

export async function refundConsumedCreditsWithClient(
  client: Prisma.TransactionClient,
  consumed: CreditConsumptionSnapshot,
  userId?: string
): Promise<void> {
  for (const c of readCreditConsumptionSnapshot(consumed)) {
    const batch = await client.creditBatch.findUnique({ where: { id: c.batchId } });
    if (!batch || (userId && batch.userId !== userId) || batch.remaining + c.amount > batch.amount) {
      throw new Error("Credit refund obligation does not match its original batch");
    }
    const changed = await client.creditBatch.updateMany({
      where: { id: c.batchId, remaining: { lte: batch.amount - c.amount } },
      data: { remaining: { increment: c.amount } },
    });
    if (changed.count !== 1) throw new CreditConsumptionConflictError();
  }
}
