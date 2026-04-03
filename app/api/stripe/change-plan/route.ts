import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type Stripe from "stripe";
import { authOptions } from "@/lib/auth-options";
import { getStripe } from "@/lib/stripe";
import {
  getPriceKeyFromStripePriceId,
  getStripePriceId,
  type PriceKey,
} from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { upsertAppUser } from "@/lib/user-sync";
import {
  buildUpgradeQuote,
  isUpgradeAllowed,
} from "@/lib/upgrade-logic";

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
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ChangePlanBody;
    const targetKey = body.priceKey as PriceKey | undefined;
    if (!targetKey || !VALID_KEYS.includes(targetKey)) {
      return NextResponse.json({ error: "Invalid priceKey" }, { status: 400 });
    }

    await upsertAppUser({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    });

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

    if (currentParsed.key === targetKey) {
      return NextResponse.json(
        { error: "Repeat purchase is not supported." },
        { status: 400 }
      );
    }

    if (!isUpgradeAllowed(currentParsed.key, targetKey)) {
      return NextResponse.json(
        { error: "This purchase is not supported. Downgrade purchases are disabled." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
    const targetPriceId = getStripePriceId(targetKey);
    const currentStripeSub = await stripe.subscriptions.retrieve(
      current.stripeSubscriptionId
    );

    const quote = await buildUpgradeQuote({
      stripe,
      currentKey: currentParsed.key,
      currentStripePriceId: current.stripePriceId,
      currentStripeSubscription: currentStripeSub,
      targetKey,
      targetPriceId,
      nextCreditAt: current.nextCreditAt,
      currentPeriodEnd: current.currentPeriodEnd,
    });

    const successQs = new URLSearchParams({
      upgrade: "success",
      from: currentParsed.key,
      to: targetKey,
      credit: String(quote.creditAmountCents),
      payable: String(quote.payableAmountCents),
      currency: quote.currency,
      months: String(quote.remainingMonths),
    });

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      client_reference_id: session.user.id,
      line_items: [{ price: targetPriceId, quantity: 1 }],
      success_url: `${baseUrl}/account/billing?${successQs.toString()}`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: {
        userId: session.user.id,
        priceKey: targetKey,
        upgradeFromSubscriptionId: current.stripeSubscriptionId,
        upgradeFromPriceKey: currentParsed.key,
      },
      subscription_data: {
        metadata: {
          userId: session.user.id,
          priceKey: targetKey,
          upgradeFromSubscriptionId: current.stripeSubscriptionId,
          upgradeFromPriceKey: currentParsed.key,
        },
        proration_behavior: "none",
        billing_cycle_anchor: Math.floor(Date.now() / 1000),
      },
    };

    if (user.stripeCustomerId) {
      sessionParams.customer = user.stripeCustomerId;
    } else {
      sessionParams.customer_email = session.user.email;
    }

    if (quote.creditAmountCents > 0) {
      const coupon = await stripe.coupons.create({
        duration: "once",
        amount_off: quote.creditAmountCents,
        currency: quote.currency,
        name: `Pro yearly remaining credit (${quote.remainingMonths}m)`,
      });
      sessionParams.discounts = [{ coupon: coupon.id }];
      sessionParams.metadata = {
        ...sessionParams.metadata,
        remainingMonthsCredit: String(quote.remainingMonths),
        creditAmountCents: String(quote.creditAmountCents),
        creditCouponId: coupon.id,
      };
    }

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);
    return NextResponse.json({ url: checkoutSession.url });
  } catch (e: unknown) {
    console.error("Stripe change plan error:", e);
    const message = e instanceof Error ? e.message : "Failed to change plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
