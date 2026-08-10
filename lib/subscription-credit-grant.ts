import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PLAN_CREDITS, type BillingKey, type PlanKey } from "@/lib/plans";
import { addMonths } from "@/lib/subscription-sync";

const MS_PER_DAY = 86_400_000;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function grantCreditsForCurrentPeriodIfNeeded(params: {
  userId: string;
  sub: Stripe.Subscription;
  parsed: { plan: PlanKey; billing: BillingKey };
  source: string;
}): Promise<boolean> {
  const grantKey = `grant_sub_${params.sub.id}_${params.sub.current_period_start}`;
  const nextCreditAt =
    params.parsed.billing === "yearly"
      ? addMonths(new Date(params.sub.current_period_start * 1000), 1)
      : null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.processedStripeEvent.create({
        data: { id: grantKey, type: "subscription_period_grant" },
      });

      const amount = PLAN_CREDITS[params.parsed.plan];
      await tx.creditBatch.create({
        data: {
          userId: params.userId,
          amount,
          remaining: amount,
          expiresAt: new Date(Date.now() + 30 * MS_PER_DAY),
          source: params.source,
        },
      });

      await tx.subscription.update({
        where: { stripeSubscriptionId: params.sub.id },
        data: { nextCreditAt },
      });
    });
    return true;
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    return false;
  }
}
