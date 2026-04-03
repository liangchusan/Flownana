import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getStripe } from "@/lib/stripe";
import {
  getPriceKeyFromStripePriceId,
  getStripePriceId,
  type PriceKey,
} from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { buildUpgradeQuote, isUpgradeAllowed } from "@/lib/upgrade-logic";

export const dynamic = "force-dynamic";

const VALID_KEYS: PriceKey[] = [
  "pro_monthly",
  "pro_yearly",
  "max_monthly",
  "max_yearly",
];

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const targetKey = url.searchParams.get("priceKey") as PriceKey | null;
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
    if (!current) {
      return NextResponse.json(
        { error: "No active subscription found." },
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

    if (!isUpgradeAllowed(currentParsed.key, targetKey)) {
      return NextResponse.json(
        { error: "This upgrade path is not supported." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
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

    return NextResponse.json({
      currentKey: currentParsed.key,
      targetKey,
      ...quote,
    });
  } catch (e: unknown) {
    console.error("Stripe change-plan quote error:", e);
    const message = e instanceof Error ? e.message : "Failed to build quote";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
