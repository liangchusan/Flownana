import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credits";
import { getPriceKeyFromStripePriceId, type PlanKey } from "@/lib/plans";
import {
  addMonths,
  upsertSubscriptionFromStripe,
} from "@/lib/subscription-sync";

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

  if (await prisma.processedStripeEvent.findUnique({ where: { id: event.id } })) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const stripe = getStripe();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId =
          session.client_reference_id || session.metadata?.userId || null;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (!userId || !customerId || !subId) {
          console.error("checkout.session.completed missing fields");
          break;
        }

        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customerId },
        });

        const sub = await stripe.subscriptions.retrieve(subId);
        const priceId = sub.items.data[0]?.price?.id;
        if (!priceId) break;

        await upsertSubscriptionFromStripe({
          userId,
          stripeSubscription: sub,
          stripePriceId: priceId,
        });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(stripe, sub);
        if (!userId) {
          console.warn("subscription event: could not resolve userId", sub.id);
          break;
        }
        const priceId = sub.items.data[0]?.price?.id;
        if (!priceId) break;
        await upsertSubscriptionFromStripe({
          userId,
          stripeSubscription: sub,
          stripePriceId: priceId,
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (!subscriptionId) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        if (sub.status !== "active" && sub.status !== "trialing") break;

        const userId = await resolveUserId(stripe, sub);
        if (!userId) break;

        const priceId = sub.items.data[0]?.price?.id;
        if (!priceId) break;

        const parsed = getPriceKeyFromStripePriceId(priceId);
        if (!parsed) break;

        await upsertSubscriptionFromStripe({
          userId,
          stripeSubscription: sub,
          stripePriceId: priceId,
        });

        const grantKey = `grant_invoice_${invoice.id}`;
        const already = await prisma.processedStripeEvent.findUnique({
          where: { id: grantKey },
        });
        if (!already) {
          await grantCredits({
            userId,
            planType: parsed.plan as PlanKey,
            source: "invoice_paid",
          });
          await prisma.processedStripeEvent.create({
            data: { id: grantKey, type: "invoice_grant" },
          });

          if (parsed.billing === "yearly") {
            const next = addMonths(new Date(), 1);
            await prisma.subscription.update({
              where: { stripeSubscriptionId: sub.id },
              data: { nextCreditAt: next },
            });
          } else {
            await prisma.subscription.update({
              where: { stripeSubscriptionId: sub.id },
              data: { nextCreditAt: null },
            });
          }
        }
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
