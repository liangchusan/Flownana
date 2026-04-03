import { prisma } from "@/lib/prisma";

export class InsufficientCreditsError extends Error {
  constructor(public required: number, public available: number) {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
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

  const now = new Date();
  const batches = await prisma.creditBatch.findMany({
    where: {
      userId,
      remaining: { gt: 0 },
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: "asc" },
  });

  let available = 0;
  for (const b of batches) {
    available += b.remaining;
  }
  if (available < amount) {
    throw new InsufficientCreditsError(amount, available);
  }

  let need = amount;
  const consumed: CreditConsumptionSnapshot = [];

  await prisma.$transaction(async (tx) => {
    for (const batch of batches) {
      if (need <= 0) break;
      const take = Math.min(need, batch.remaining);
      if (take <= 0) continue;

      const updated = await tx.creditBatch.updateMany({
        where: {
          id: batch.id,
          remaining: { gte: take },
        },
        data: {
          remaining: { decrement: take },
        },
      });

      if (updated.count !== 1) {
        throw new Error("Credit consumption conflict. Please retry.");
      }

      consumed.push({ batchId: batch.id, amount: take });
      need -= take;
    }

    if (need > 0) {
      throw new Error("Credit consumption failed unexpectedly.");
    }
  });

  return consumed;
}

export async function refundConsumedCredits(
  consumed: CreditConsumptionSnapshot
): Promise<void> {
  if (!consumed.length) return;

  await prisma.$transaction(
    consumed.map((c) =>
      prisma.creditBatch.update({
        where: { id: c.batchId },
        data: { remaining: { increment: c.amount } },
      })
    )
  );
}

