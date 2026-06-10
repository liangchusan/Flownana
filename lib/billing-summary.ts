import { prisma } from "@/lib/prisma";
import { getCreditSummary } from "@/lib/credits";
import { PLAN_RESOLUTION, PLAN_CREDITS } from "@/lib/plans";

export async function getBillingSummary(userId: string) {
  const [sub, credits] = await Promise.all([
    prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ["active", "trialing"] },
      },
      orderBy: { createdAt: "desc" },
    }),
    getCreditSummary(userId),
  ]);

  return {
    subscription: sub
      ? {
          planType: sub.planType,
          billingCycle: sub.billingCycle,
          status: sub.status,
          resolution: PLAN_RESOLUTION[sub.planType as "pro" | "max"],
          creditsPerMonth: PLAN_CREDITS[sub.planType as "pro" | "max"],
          currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        }
      : null,
    credits: {
      current: credits.total,
      expiringSoon: credits.expiringSoon,
      expiringInDays: credits.expiringInDays,
    },
  };
}
