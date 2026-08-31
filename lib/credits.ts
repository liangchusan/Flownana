import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { PlanKey } from "@/lib/plans";
import { PLAN_CREDITS } from "@/lib/plans";

const MS_PER_DAY = 86_400_000;

export async function grantCredits(params: {
  userId: string;
  planType: PlanKey;
  source: string;
}): Promise<void> {
  const amount = PLAN_CREDITS[params.planType];
  const expiresAt = new Date(Date.now() + 30 * MS_PER_DAY);

  await prisma.creditBatch.create({
    data: {
      userId: params.userId,
      amount,
      remaining: amount,
      expiresAt,
      source: params.source,
    },
  });
}

export async function getCreditSummary(userId: string, client: Prisma.TransactionClient = prisma): Promise<{
  total: number;
  expiringSoon: number;
  expiringInDays: number | null;
}> {
  const now = new Date();
  const activeWhere = {
    userId,
    remaining: { gt: 0 },
    expiresAt: { gt: now },
  };

  const [totalResult, soon] = await Promise.all([
    client.creditBatch.aggregate({
      where: activeWhere,
      _sum: { remaining: true },
    }),
    client.creditBatch.findFirst({
      where: activeWhere,
      orderBy: { expiresAt: "asc" },
    }),
  ]);

  if (!soon) {
    return { total: totalResult._sum.remaining ?? 0, expiringSoon: 0, expiringInDays: null };
  }

  const days = Math.ceil(
    (soon.expiresAt.getTime() - now.getTime()) / MS_PER_DAY
  );

  return {
    total: totalResult._sum.remaining ?? 0,
    expiringSoon: soon.remaining,
    expiringInDays: days,
  };
}
