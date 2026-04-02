import { prisma } from "@/lib/prisma";
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

export async function getCreditSummary(userId: string): Promise<{
  total: number;
  expiringSoon: number;
  expiringInDays: number | null;
}> {
  const now = new Date();
  const batches = await prisma.creditBatch.findMany({
    where: {
      userId,
      remaining: { gt: 0 },
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: "asc" },
  });

  // Explicitly type reduce accumulator to avoid TS "implicit any" in stricter builds.
  const total = batches.reduce((s: number, b) => s + b.remaining, 0);

  const soon = batches[0];
  if (!soon) {
    return { total: 0, expiringSoon: 0, expiringInDays: null };
  }

  const days = Math.ceil(
    (soon.expiresAt.getTime() - now.getTime()) / MS_PER_DAY
  );

  return {
    total,
    expiringSoon: soon.remaining,
    expiringInDays: days,
  };
}
