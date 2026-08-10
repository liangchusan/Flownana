import type Stripe from "stripe";
import { getCheckoutCompletionError } from "@/lib/checkout-completion-policy";
import { prisma } from "@/lib/prisma";
import {
  getPriceKeyFromStripePriceId,
  type PriceKey,
} from "@/lib/plans";
import { getStripe } from "@/lib/stripe";
import { grantCreditsForCurrentPeriodIfNeeded } from "@/lib/subscription-credit-grant";
import { upsertSubscriptionFromStripe } from "@/lib/subscription-sync";

export type CheckoutFinalizationResult = {
  priceKey: PriceKey;
  isUpgrade: boolean;
  payableAmountCents: number;
  creditAmountCents: number;
  currency: string;
  creditsGranted: boolean;
};

function getObjectId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function cancelPreviousSubscription(params: {
  stripe: ReturnType<typeof getStripe>;
  userId: string;
  subscriptionId: string;
}) {
  let previous = await params.stripe.subscriptions.retrieve(
    params.subscriptionId
  );

  if (previous.status !== "canceled") {
    try {
      previous = await params.stripe.subscriptions.cancel(
        params.subscriptionId,
        { prorate: false }
      );
    } catch (error) {
      // A webhook and the return page can finalize the same Checkout Session at
      // nearly the same time. Accept the race only if Stripe now confirms that
      // the previous subscription is canceled.
      const refreshed = await params.stripe.subscriptions.retrieve(
        params.subscriptionId
      );
      if (refreshed.status !== "canceled") throw error;
      previous = refreshed;
    }
  }

  const oldPriceId = previous.items.data[0]?.price?.id;
  if (!oldPriceId) {
    throw new Error(
      `Canceled subscription ${params.subscriptionId} has no price`
    );
  }

  await upsertSubscriptionFromStripe({
    userId: params.userId,
    stripeSubscription: previous,
    stripePriceId: oldPriceId,
  });
}

export async function finalizeCheckoutSession(params: {
  sessionId: string;
  expectedUserId?: string;
  source: string;
}): Promise<CheckoutFinalizationResult> {
  const stripe = getStripe();
  const checkoutSession = await stripe.checkout.sessions.retrieve(
    params.sessionId
  );

  const userId =
    checkoutSession.client_reference_id ||
    checkoutSession.metadata?.userId ||
    null;
  const completionError = getCheckoutCompletionError(
    {
      mode: checkoutSession.mode,
      status: checkoutSession.status,
      paymentStatus: checkoutSession.payment_status,
      userId,
    },
    params.expectedUserId
  );
  if (completionError) throw new Error(completionError);
  if (!userId) throw new Error("Checkout Session has no user");

  const customerId = getObjectId(checkoutSession.customer);
  const subscriptionId = getObjectId(checkoutSession.subscription);
  if (!customerId || !subscriptionId) {
    throw new Error("Checkout Session is missing its customer or subscription");
  }

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  if (sub.status !== "active" && sub.status !== "trialing") {
    throw new Error(`Subscription is not active (${sub.status})`);
  }

  const priceId = sub.items.data[0]?.price?.id;
  const parsed = priceId ? getPriceKeyFromStripePriceId(priceId) : null;
  if (!priceId || !parsed) {
    throw new Error("Subscription price is not recognized");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customerId },
  });

  await upsertSubscriptionFromStripe({
    userId,
    stripeSubscription: sub,
    stripePriceId: priceId,
  });

  const upgradeFromSubscriptionId =
    checkoutSession.metadata?.upgradeFromSubscriptionId || null;
  if (
    upgradeFromSubscriptionId &&
    upgradeFromSubscriptionId !== subscriptionId
  ) {
    await cancelPreviousSubscription({
      stripe,
      userId,
      subscriptionId: upgradeFromSubscriptionId,
    });
  }

  const creditsGranted = await grantCreditsForCurrentPeriodIfNeeded({
    userId,
    sub,
    parsed: { plan: parsed.plan, billing: parsed.billing },
    source: params.source,
  });

  return {
    priceKey: parsed.key,
    isUpgrade: Boolean(upgradeFromSubscriptionId),
    payableAmountCents: checkoutSession.amount_total ?? 0,
    creditAmountCents: Number(
      checkoutSession.metadata?.creditAmountCents || "0"
    ),
    currency: (checkoutSession.currency || "usd").toUpperCase(),
    creditsGranted,
  };
}
