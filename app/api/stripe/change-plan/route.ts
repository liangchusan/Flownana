import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type Stripe from "stripe";
import { authOptions } from "@/lib/auth-options";
import { getStripe } from "@/lib/stripe";
import {
  getPriceKeyFromStripePriceId,
  getStripePriceId,
  PLAN_CREDITS,
  type PlanKey,
  type PriceKey,
} from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credits";
import { upsertSubscriptionFromStripe } from "@/lib/subscription-sync";

const VALID_KEYS: PriceKey[] = [
  "pro_monthly",
  "pro_yearly",
  "max_monthly",
  "max_yearly",
];

type ChangePlanBody = {
  priceKey?: string;
};

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ChangePlanBody;
    const targetKey = body.priceKey as PriceKey | undefined;
    if (!targetKey || !VALID_KEYS.includes(targetKey)) {
      return NextResponse.json({ error: "Invalid priceKey" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        subscriptions: {
          where: { status: { in: ["active", "trialing"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const current = user?.subscriptions?.[0];
    if (!user || !current) {
      return NextResponse.json(
        { error: "No active subscription. Use checkout first." },
        { status: 400 }
      );
    }

    const currentParsed = getPriceKeyFromStripePriceId(current.stripePriceId);
    if (!currentParsed) {
      return NextResponse.json(
        { error: "Current subscription price is not recognized." },
        { status: 400 }
      );
    }
    const targetPriceId = getStripePriceId(targetKey);
    const targetParsed = getPriceKeyFromStripePriceId(targetPriceId);
    if (!targetParsed) {
      return NextResponse.json({ error: "Target price is not recognized." }, { status: 400 });
    }

    if (current.stripePriceId === targetPriceId) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    const isUpgrade =
      PLAN_CREDITS[targetParsed.plan] > PLAN_CREDITS[currentParsed.plan];
    if (!isUpgrade) {
      return NextResponse.json(
        { error: "Downgrade or billing-cycle switch should be done in Stripe portal." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(current.stripeSubscriptionId);
    const itemId = sub.items.data[0]?.id;
    if (!itemId) {
      return NextResponse.json({ error: "Subscription item not found." }, { status: 400 });
    }

    const updated = await stripe.subscriptions.update(sub.id, {
      items: [{ id: itemId, price: targetPriceId }],
      proration_behavior: "always_invoice",
      cancel_at_period_end: false,
      metadata: {
        ...(sub.metadata || {}),
        userId: session.user.id,
        priceKey: targetKey,
      },
    });

    await upsertSubscriptionFromStripe({
      userId: session.user.id,
      stripeSubscription: updated,
      stripePriceId: targetPriceId,
    });

    // Grant immediate upgrade credits once per subscription period + target plan.
    const grantKey = `grant_upgrade_${updated.id}_${updated.current_period_start}_${targetParsed.plan}`;
    const already = await prisma.processedStripeEvent.findUnique({
      where: { id: grantKey },
    });
    if (!already) {
      await grantCredits({
        userId: session.user.id,
        planType: targetParsed.plan as PlanKey,
        source: "upgrade_immediate",
      });
      await prisma.processedStripeEvent.create({
        data: { id: grantKey, type: "upgrade_credit_grant" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("Stripe change plan error:", e);
    const message = e instanceof Error ? e.message : "Failed to change plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

