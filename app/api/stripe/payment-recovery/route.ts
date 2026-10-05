import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { matchesRequestAccount } from "@/lib/account-scope";
import { sessionAccountWhere } from "@/lib/account-session";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { BILLING_READ_OPTIONS } from "@/lib/subscription-sync";
import { getSubscriptionOwnershipError, stripeInvoiceSubscriptionId, stripeObjectId } from "@/lib/stripe-billing-policy";
import { canFinalizeStripeCheckout, canProcessStripeBilling } from "@/lib/stripe-production-access";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !matchesRequestAccount(request, session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canProcessStripeBilling({ secretKey: process.env.STRIPE_SECRET_KEY,
    vercelEnv: process.env.VERCEL_ENV })) {
    return NextResponse.json({ error: "Billing is unavailable in this environment." }, { status: 503 });
  }

  try {
    const user = await prisma.user.findUnique({ where: sessionAccountWhere(session.user) });
    if (!user?.stripeCustomerId) return NextResponse.json({ error: "No billing account" }, { status: 404 });
    const local = await prisma.subscription.findFirst({
      where: { userId: user.id, status: { in: ["incomplete", "past_due", "unpaid", "paused"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!local) return NextResponse.json({ error: "No unpaid subscription" }, { status: 404 });

    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(local.stripeSubscriptionId, {}, BILLING_READ_OPTIONS);
    if (getSubscriptionOwnershipError(user, sub) ||
      stripeObjectId(sub.customer) !== user.stripeCustomerId ||
      !["incomplete", "past_due", "unpaid"].includes(sub.status)) {
      return NextResponse.json({ error: "Subscription is not eligible for payment recovery" }, { status: 409 });
    }
    const invoiceId = stripeObjectId(sub.latest_invoice);
    if (!invoiceId) return NextResponse.json({ error: "No outstanding invoice" }, { status: 409 });
    const invoice = await stripe.invoices.retrieve(invoiceId, {}, BILLING_READ_OPTIONS);
    if (!user.email || !canFinalizeStripeCheckout({ livemode: invoice.livemode,
      vercelEnv: process.env.VERCEL_ENV })) {
      return NextResponse.json({ error: "Payment recovery is not available for this account" }, { status: 403 });
    }
    if (invoice.paid || invoice.status !== "open" ||
      stripeObjectId(invoice.customer) !== user.stripeCustomerId ||
      stripeInvoiceSubscriptionId(invoice) !== sub.id || !invoice.hosted_invoice_url) {
      return NextResponse.json({ error: "No payable invoice is available. Contact support." }, { status: 409 });
    }
    const url = new URL(invoice.hosted_invoice_url);
    if (url.protocol !== "https:" || url.hostname !== "invoice.stripe.com") {
      return NextResponse.json({ error: "Payment link unavailable" }, { status: 409 });
    }
    return NextResponse.json({ url: url.href }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Payment recovery link unavailable:", error);
    return NextResponse.json({ error: "Payment link unavailable" }, { status: 503 });
  }
}
