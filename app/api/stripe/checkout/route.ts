import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { matchesRequestAccount } from "@/lib/account-scope";
import { isPriceKey } from "@/lib/plans";
import { canCreateStripeCheckout } from "@/lib/stripe-production-access";
import { CheckoutConflictError, createReservedCheckout } from "@/lib/checkout-reservation";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.email || !matchesRequestAccount(request, session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canCreateStripeCheckout({ email: session.user.email, secretKey: process.env.STRIPE_SECRET_KEY,
      vercelEnv: process.env.VERCEL_ENV, allowedEmails: process.env.STRIPE_TEST_MODE_ALLOWED_EMAILS })) {
      return NextResponse.json({ error: "Checkout is unavailable until live payments are enabled." }, { status: 503 });
    }
    const body = await request.json().catch(() => null);
    if (!isPriceKey(body?.priceKey)) return NextResponse.json({ error: "Invalid priceKey" }, { status: 400 });
    const result = await createReservedCheckout({
      userId: session.user.id, accountCreatedAt: session.user.accountCreatedAt,
      kind: "purchase", priceKey: body.priceKey,
      baseUrl: process.env.NEXTAUTH_URL || new URL(request.url).origin,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Stripe purchase checkout failed:", error);
    return NextResponse.json({ error: error instanceof CheckoutConflictError ? error.message : "Checkout could not be confirmed. Please check Billing and try again." },
      { status: error instanceof CheckoutConflictError ? 409 : 503 });
  }
}
