import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { matchesRequestAccount } from "@/lib/account-scope";
import { isPriceKey } from "@/lib/plans";
import { CheckoutConflictError, getReservedUpgradeQuote } from "@/lib/checkout-reservation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !matchesRequestAccount(request, session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const targetKey = new URL(request.url).searchParams.get("priceKey");
    if (!targetKey || !isPriceKey(targetKey)) return NextResponse.json({ error: "Invalid priceKey" }, { status: 400 });
    return NextResponse.json(await getReservedUpgradeQuote(session.user.id, session.user.accountCreatedAt, targetKey));
  } catch (error) {
    console.error("Stripe upgrade quote failed:", error);
    return NextResponse.json({ error: error instanceof CheckoutConflictError ? error.message : "Your upgrade quote could not be confirmed. Please try again." },
      { status: error instanceof CheckoutConflictError ? 409 : 503 });
  }
}
