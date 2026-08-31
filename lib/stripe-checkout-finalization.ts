import type Stripe from "stripe";
import { getCheckoutCompletionError } from "@/lib/checkout-completion-policy";
import { prisma } from "@/lib/prisma";
import {
  getPriceKeyFromStripePriceId,
  type PriceKey,
} from "@/lib/plans";
import { getStripe } from "@/lib/stripe";
import { grantCreditsForCurrentPeriodIfNeeded } from "@/lib/subscription-credit-grant";
import { BILLING_READ_OPTIONS } from "@/lib/subscription-sync";
import { BillingOwnershipError, getSubscriptionOwnershipError, stripeObjectId } from "@/lib/stripe-billing-policy";
import { canFinalizeStripeCheckout } from "@/lib/stripe-production-access";

export type CheckoutFinalizationResult = {
  priceKey: PriceKey;
  isUpgrade: boolean;
  payableAmountCents: number;
  creditAmountCents: number;
  currency: string;
  creditsGranted: boolean;
};

export async function finalizeCheckoutSession(params: {
  sessionId: string;
  expectedUserId?: string;
  expectedAccountCreatedAt?: string;
  source: string;
}): Promise<CheckoutFinalizationResult> {
  const stripe = getStripe();
  const checkoutSession = await stripe.checkout.sessions.retrieve(
    params.sessionId, {}, BILLING_READ_OPTIONS
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

  const checkoutUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, createdAt: true, stripeCustomerId: true },
  });
  if (!checkoutUser || (params.expectedAccountCreatedAt &&
    checkoutUser.createdAt.toISOString() !== params.expectedAccountCreatedAt) ||
    (checkoutSession.metadata?.accountCreatedAt &&
      checkoutUser.createdAt.toISOString() !== checkoutSession.metadata.accountCreatedAt) ||
    (!checkoutSession.metadata?.accountCreatedAt &&
      (!Number.isFinite(checkoutSession.created) || checkoutSession.created * 1000 < checkoutUser.createdAt.getTime()))) {
    throw new BillingOwnershipError("Checkout account no longer exists");
  }
  if (
    !checkoutUser?.email ||
    !canFinalizeStripeCheckout({
      email: checkoutUser.email,
      livemode: checkoutSession.livemode,
      vercelEnv: process.env.VERCEL_ENV,
      allowedEmails: process.env.STRIPE_TEST_MODE_ALLOWED_EMAILS,
    })
  ) {
    throw new Error("Test-mode Checkout is not allowed for this account");
  }

  const customerId = stripeObjectId(checkoutSession.customer);
  const subscriptionId = stripeObjectId(checkoutSession.subscription);
  const invoiceId = stripeObjectId(checkoutSession.invoice);
  if (!customerId || !subscriptionId || !invoiceId) {
    throw new Error("Checkout Session is missing its customer, subscription or invoice");
  }

  const sub: Stripe.Subscription = await stripe.subscriptions.retrieve(subscriptionId, {}, BILLING_READ_OPTIONS);
  const ownershipError = getSubscriptionOwnershipError(checkoutUser, sub, checkoutSession.created);
  if (ownershipError) throw new BillingOwnershipError(ownershipError);

  const priceId = sub.items.data[0]?.price?.id;
  const parsed = priceId ? getPriceKeyFromStripePriceId(priceId) : null;
  if (!priceId || !parsed) {
    throw new Error("Subscription price is not recognized");
  }

  const upgradeFromSubscriptionId =
    sub.metadata.upgradeFromSubscriptionId || null;
  if ((checkoutSession.metadata?.upgradeFromSubscriptionId || null) !== upgradeFromSubscriptionId) {
    throw new Error("Checkout upgrade metadata does not match subscription");
  }

  const creditsGranted = await grantCreditsForCurrentPeriodIfNeeded({
    userId,
    sub,
    invoiceId,
    expectedAccountCreatedAt: checkoutUser.createdAt.toISOString(),
    expectedCustomerId: customerId,
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
