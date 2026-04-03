import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import {
  getPriceKeyFromStripePriceId,
  PLAN_CREDITS,
  type PlanKey,
} from "@/lib/plans";
import {
  addMonths,
  upsertSubscriptionFromStripe,
} from "@/lib/subscription-sync";

export const dynamic = "force-dynamic";
const MS_PER_DAY = 86_400_000;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

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

async function grantCreditsForCurrentPeriodIfNeeded(params: {
  userId: string;
  sub: Stripe.Subscription;
  parsed: { plan: PlanKey; billing: "monthly" | "yearly" };
  source: string;
}) {
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
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }
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
        const upgradeFromSubId = session.metadata?.upgradeFromSubscriptionId || null;

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
        const parsed = getPriceKeyFromStripePriceId(priceId);
        if (!parsed) break;

        await upsertSubscriptionFromStripe({
          userId,
          stripeSubscription: sub,
          stripePriceId: priceId,
        });

        if (
          session.payment_status === "paid" &&
          upgradeFromSubId &&
          upgradeFromSubId !== sub.id
        ) {
          try {
            const canceled = await stripe.subscriptions.cancel(upgradeFromSubId, {
              prorate: false,
            });
            const oldPriceId = canceled.items.data[0]?.price?.id;
            if (oldPriceId) {
              await upsertSubscriptionFromStripe({
                userId,
                stripeSubscription: canceled,
                stripePriceId: oldPriceId,
              });
            }
          } catch (cancelError) {
            console.error("Failed to cancel previous subscription:", cancelError);
          }
        }

        if (
          session.payment_status === "paid" &&
          (sub.status === "active" || sub.status === "trialing")
        ) {
          await grantCreditsForCurrentPeriodIfNeeded({
            userId,
            sub,
            parsed: { plan: parsed.plan as PlanKey, billing: parsed.billing },
            source: "checkout_session_paid",
          });
        }
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

        const userId = await resolveUserIdFromInvoice(stripe, invoice, sub);
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

        await grantCreditsForCurrentPeriodIfNeeded({
          userId,
          sub,
          parsed: { plan: parsed.plan as PlanKey, billing: parsed.billing },
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
