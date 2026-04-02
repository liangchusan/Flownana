import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getPriceKeyFromStripePriceId } from "@/lib/plans";

export async function upsertSubscriptionFromStripe(params: {
  userId: string;
  stripeSubscription: Stripe.Subscription;
  stripePriceId: string;
}): Promise<void> {
  const parsed = getPriceKeyFromStripePriceId(params.stripePriceId);
  if (!parsed) {
    console.warn("Unknown Stripe price id:", params.stripePriceId);
    return;
  }

  const start = new Date(params.stripeSubscription.current_period_start * 1000);
  const end = new Date(params.stripeSubscription.current_period_end * 1000);

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: params.stripeSubscription.id },
    create: {
      userId: params.userId,
      stripeSubscriptionId: params.stripeSubscription.id,
      stripePriceId: params.stripePriceId,
      planType: parsed.plan,
      billingCycle: parsed.billing,
      status: params.stripeSubscription.status,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: params.stripeSubscription.cancel_at_period_end,
    },
    update: {
      stripePriceId: params.stripePriceId,
      planType: parsed.plan,
      billingCycle: parsed.billing,
      status: params.stripeSubscription.status,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: params.stripeSubscription.cancel_at_period_end,
    },
  });
}

export function addMonths(d: Date, months: number): Date {
  const x = new Date(d.getTime());
  const day = x.getDate();
  x.setMonth(x.getMonth() + months);
  if (x.getDate() < day) {
    x.setDate(0);
  }
  return x;
}
