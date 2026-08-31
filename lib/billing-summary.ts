import { withBillingUser } from "@/lib/billing-transaction";
import { getAccountScope } from "@/lib/account-scope";
import { getCreditSummary } from "@/lib/credits";
import {
  getPriceKeyFromStripePriceId,
  PLAN_RESOLUTION,
  PLAN_CREDITS,
} from "@/lib/plans";

export async function getBillingSummary(userId: string, accountCreatedAt?: string) {
  return withBillingUser(userId, async (tx, user) => {
    const [sub, credits] = await Promise.all([
      tx.subscription.findFirst({
        where: {
          userId,
          status: { in: ["active", "trialing"] },
        },
        orderBy: { createdAt: "desc" },
      }),
      getCreditSummary(userId, tx),
    ]);

    const parsedSubscription = sub
      ? getPriceKeyFromStripePriceId(sub.stripePriceId)
      : null;

    return {
      accountScope: getAccountScope({ id: user.id, accountCreatedAt: user.createdAt.toISOString() }),
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
  }, accountCreatedAt);
}
