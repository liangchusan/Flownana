import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getPriceKeyFromStripePriceId } from "@/lib/plans";
import { upsertSubscriptionFromStripe } from "@/lib/subscription-sync";
import { getStripeStateSyncKind } from "@/lib/stripe-event-policy";
import { grantCreditsForCurrentPeriodIfNeeded } from "@/lib/subscription-credit-grant";
import { finalizeCheckoutSession } from "@/lib/stripe-checkout-finalization";
import { shouldIgnoreStripeTestWebhook } from "@/lib/stripe-production-access";

export const dynamic = "force-dynamic";

async function resolveUserId(
  stripe: ReturnType<typeof getStripe>,
  sub: Stripe.Subscription
): Promise<string | null> {
  const meta = sub.metadata?.userId;
  if (meta) return meta;
  const customerId =
    typeof sub.customer === "string"
      ? sub.customer
      : sub.customer?.id;
  if (!customerId) return null;
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });
  return user?.id ?? null;
}

async function resolveUserIdFromInvoice(
  stripe: ReturnType<typeof getStripe>,
  invoice: Stripe.Invoice,
  sub?: Stripe.Subscription
): Promise<string | null> {
  if (sub) {
    const fromSub = await resolveUserId(stripe, sub);
    if (fromSub) return fromSub;
  }

  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (customerId) {
    const userByCustomer = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (userByCustomer?.id) return userByCustomer.id;
  }

  const email =
    invoice.customer_email ||
    (invoice.customer &&
    typeof invoice.customer === "object" &&
    "email" in invoice.customer
      ? invoice.customer.email
      : null);
  if (email) {
    const userByEmail = await prisma.user.findUnique({ where: { email } });
    if (userByEmail?.id) return userByEmail.id;
  }

  return null;
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

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = await resolveUserIdFromInvoice(stripe, invoice, sub);
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
      const userId = await resolveUserId(stripe, sub);
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

        const { sub, userId, priceId } = context;
        if (sub.status !== "active" && sub.status !== "trialing") break;

        const parsed = getPriceKeyFromStripePriceId(priceId);
        if (!parsed) break;

        await upsertSubscriptionFromStripe({
          userId,
          stripeSubscription: sub,
          stripePriceId: priceId,
        });

        await grantCreditsForCurrentPeriodIfNeeded({
          userId,
          sub,
          parsed: { plan: parsed.plan, billing: parsed.billing },
          source: "invoice_paid",
        });
        break;
      }

      default:
        break;
    }

    await prisma.processedStripeEvent.create({
      data: { id: event.id, type: event.type },
    });
  } catch (e) {
    console.error("Webhook handler error:", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
