import { prisma } from "@/lib/prisma";
import { getCreditSummary } from "@/lib/credits";
import {
  getPriceKeyFromStripePriceId,
  PLAN_RESOLUTION,
  PLAN_CREDITS,
} from "@/lib/plans";

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

  const parsedSubscription = sub
    ? getPriceKeyFromStripePriceId(sub.stripePriceId)
    : null;

  return {
    subscription: sub && parsedSubscription
      ? {
          planType: parsedSubscription.plan,
          billingCycle: parsedSubscription.billing,
          status: sub.status,
          resolution: PLAN_RESOLUTION[parsedSubscription.plan],
          creditsPerMonth: PLAN_CREDITS[parsedSubscription.plan],
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
