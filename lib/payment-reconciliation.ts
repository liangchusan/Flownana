import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { grantCreditsForCurrentPeriodIfNeeded } from "@/lib/subscription-credit-grant";
import { BILLING_READ_OPTIONS } from "@/lib/subscription-sync";
import { stripeObjectId } from "@/lib/stripe-billing-policy";
import { canProcessStripeBilling } from "@/lib/stripe-production-access";

// Hosted Invoice payments may finish without returning through Checkout. The
// Billing page can safely catch up if webhook delivery is delayed or missed.
export async function reconcilePendingPayment(userId: string, accountCreatedAt: string): Promise<void> {
  if (!canProcessStripeBilling({ secretKey: process.env.STRIPE_SECRET_KEY,
    vercelEnv: process.env.VERCEL_ENV })) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, stripeCustomerId: true },
  });
  if (!user || user.createdAt.toISOString() !== accountCreatedAt || !user.stripeCustomerId) return;
  const pending = await prisma.subscription.findFirst({
    where: { userId, status: { in: ["incomplete", "past_due", "unpaid", "paused"] } },
    orderBy: { createdAt: "desc" },
    select: { stripeSubscriptionId: true },
  });
  if (!pending) return;

  const sub = await getStripe().subscriptions.retrieve(pending.stripeSubscriptionId, {}, BILLING_READ_OPTIONS);
  const invoiceId = stripeObjectId(sub.latest_invoice);
  if (!invoiceId) return;
  await grantCreditsForCurrentPeriodIfNeeded({
    userId,
    sub,
    invoiceId,
    source: "billing_payment_reconciliation",
    expectedAccountCreatedAt: accountCreatedAt,
    expectedCustomerId: user.stripeCustomerId,
  });
}
