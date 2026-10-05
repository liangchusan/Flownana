import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { matchesRequestAccount } from "@/lib/account-scope";
import { sessionAccountWhere } from "@/lib/account-session";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { canProcessStripeBilling } from "@/lib/stripe-production-access";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !matchesRequestAccount(request, session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canProcessStripeBilling({ secretKey: process.env.STRIPE_SECRET_KEY,
      vercelEnv: process.env.VERCEL_ENV })) {
      return NextResponse.json({ error: "Billing is unavailable in this environment." }, { status: 503 });
    }

    const user = await prisma.user.findUnique({
      where: sessionAccountWhere(session.user),
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account yet. Subscribe to a plan first." },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXTAUTH_URL || new URL(request.url).origin;

    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/account/billing`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (e: unknown) {
    console.error("Stripe portal error:", e);
    const message =
      e instanceof Error ? e.message : "Failed to open billing portal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
