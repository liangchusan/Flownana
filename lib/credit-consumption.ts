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
  consumed: CreditConsumptionSnapshot
): Promise<void> {
  for (const c of consumed) {
    await client.creditBatch.update({
        where: { id: c.batchId },
        data: { remaining: { increment: c.amount } },
    });
  }
}
