import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getStripePriceId, type PriceKey } from "@/lib/plans";
import { upsertAppUser } from "@/lib/user-sync";
import { prisma } from "@/lib/prisma";

const VALID_KEYS: PriceKey[] = [
  "pro_monthly",
  "pro_yearly",
  "max_monthly",
  "max_yearly",
];

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { priceKey?: string };
    const priceKey = body.priceKey as PriceKey | undefined;
    if (!priceKey || !VALID_KEYS.includes(priceKey)) {
      return NextResponse.json({ error: "Invalid priceKey" }, { status: 400 });
    }

    await upsertAppUser({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    });

    const baseUrl =
      process.env.NEXTAUTH_URL || new URL(request.url).origin;
    const priceId = getStripePriceId(priceKey);

    const stripe = getStripe();

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

    if (user?.subscriptions?.[0]) {
      return NextResponse.json(
        {
          error:
            "You already have an active subscription. Use the upgrade flow on pricing page.",
        },
        { status: 400 }
      );
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      client_reference_id: session.user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/account/billing?checkout=success`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: {
        userId: session.user.id,
        priceKey,
      },
      subscription_data: {
        metadata: {
          userId: session.user.id,
          priceKey,
        },
      },
    };

    if (user?.stripeCustomerId) {
      sessionParams.customer = user.stripeCustomerId;
    } else {
      sessionParams.customer_email = session.user.email;
    }

    const checkoutSession = await stripe.checkout.sessions.create(
      sessionParams
    );

    return NextResponse.json({ url: checkoutSession.url });
  } catch (e: unknown) {
    console.error("Stripe checkout error:", e);
    const message =
      e instanceof Error ? e.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
