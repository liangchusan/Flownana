import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { BILLING_READ_OPTIONS, upsertSubscriptionFromStripe } from "@/lib/subscription-sync";
import { BillingOwnershipError, stripeObjectId } from "@/lib/stripe-billing-policy";
import { getStripeStateSyncKind } from "@/lib/stripe-event-policy";
import { grantCreditsForCurrentPeriodIfNeeded } from "@/lib/subscription-credit-grant";
import { finalizeCheckoutSession } from "@/lib/stripe-checkout-finalization";
import { shouldIgnoreStripeTestWebhook } from "@/lib/stripe-production-access";

export const dynamic = "force-dynamic";

async function resolveUserId(
  sub: Stripe.Subscription
): Promise<string | null> {
  const meta = sub.metadata?.userId;
  const customerId = stripeObjectId(sub.customer);
  if (!customerId) return null;
  const user = meta ? await prisma.user.findUnique({ where: { id: meta } }) : await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });
  // Email alone is not an ownership binding, especially after deletion and
  // re-registration. Ignore subscriptions attached to a previous account.
  // Ownership (including any legacy Checkout lookup) is enforced inside the
  // shared lock; do not discard an unbound legacy account before that proof.
  return user?.id ?? null;
}

async function getSubscriptionContextFromInvoice(
  stripe: ReturnType<typeof getStripe>,
  invoice: Stripe.Invoice
): Promise<{
  sub: Stripe.Subscription;
  userId: string;
  priceId: string;
} | null> {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;
  if (!subscriptionId) return null;

  const sub = await stripe.subscriptions.retrieve(subscriptionId, {}, BILLING_READ_OPTIONS);
  const userId = await resolveUserId(sub);
  const priceId = sub.items.data[0]?.price?.id;
  if (!userId || !priceId) return null;

  return { sub, userId, priceId };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !sig) {
    return NextResponse.json({ error: "Webhook misconfigured" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    console.error("Stripe webhook signature error:", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (
    shouldIgnoreStripeTestWebhook({
      livemode: event.livemode,
      vercelEnv: process.env.VERCEL_ENV,
    })
  ) {
    return NextResponse.json({ received: true, ignored: true });
  }

  if (await prisma.processedStripeEvent.findUnique({ where: { id: event.id } })) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const stripe = getStripe();

  try {
    const stateSyncKind = getStripeStateSyncKind(event.type);

    if (stateSyncKind === "subscription") {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await resolveUserId(sub);
      if (!userId) {
        console.warn("subscription event: could not resolve userId", sub.id);
      } else {
        const priceId = sub.items.data[0]?.price?.id;
        if (priceId) {
          await upsertSubscriptionFromStripe({
            userId,
            stripeSubscription: sub,
            stripePriceId: priceId,
          });
        }
      }
    } else if (stateSyncKind === "invoice") {
      const invoice = event.data.object as Stripe.Invoice;
      const context = await getSubscriptionContextFromInvoice(stripe, invoice);
      if (context) {
        await upsertSubscriptionFromStripe({
          userId: context.userId,
          stripeSubscription: context.sub,
          stripePriceId: context.priceId,
        });
      }
    } else switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        await finalizeCheckoutSession({
          sessionId: session.id,
          source: "checkout_session_paid",
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const context = await getSubscriptionContextFromInvoice(stripe, invoice);
        if (!context) break;

        const { sub, userId } = context;
        await grantCreditsForCurrentPeriodIfNeeded({
          userId,
          sub,
          invoiceId: invoice.id,
          source: "invoice_paid",
        });
        break;
      }

      default:
        break;
    }

    await prisma.processedStripeEvent.upsert({
      where: { id: event.id },
      create: { id: event.id, type: event.type },
      update: {},
    });
  } catch (e) {
    if (e instanceof BillingOwnershipError) {
      // A verified event from a deleted account cannot become valid on retry.
      // Never swallow provider/database failures, which must remain retryable.
      await prisma.processedStripeEvent.upsert({
        where: { id: event.id }, create: { id: event.id, type: event.type }, update: {},
      });
      return NextResponse.json({ received: true, ignored: true });
    }
    console.error("Webhook handler error:", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
