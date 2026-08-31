import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { grantDueYearlyCredits } from "@/lib/subscription-credit-grant";
import { cleanupOrphanedMediaUploads } from "@/lib/media-upload-cleanup";
import { canCreateStripeCheckout } from "@/lib/stripe-production-access";

export const dynamic = "force-dynamic";

/** Yearly months 2–12. Each selected ID is revalidated under the billing lock. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const subs = await prisma.subscription.findMany({
    where: {
      billingCycle: "yearly",
      status: { in: ["active", "trialing"] },
      nextCreditAt: { lte: now },
    },
    select: { id: true, userId: true, stripeSubscriptionId: true, user: { select: { email: true } } },
  });
  let granted = 0;
  let duplicates = 0;
  let ignored = 0;
  const failed: string[] = [];
  for (const sub of subs) {
    if (!canCreateStripeCheckout({
      email: sub.user.email,
      secretKey: process.env.STRIPE_SECRET_KEY,
      vercelEnv: process.env.VERCEL_ENV,
      allowedEmails: process.env.STRIPE_TEST_MODE_ALLOWED_EMAILS,
    })) {
      ignored += 1;
      continue;
    }
    try {
      const result = await grantDueYearlyCredits({
        userId: sub.userId, stripeSubscriptionId: sub.stripeSubscriptionId, now,
      });
      granted += result.granted;
      duplicates += result.duplicates;
    } catch (error) {
      console.error(`[cron/monthly-credits] Failed subscription ${sub.id}:`, error);
      failed.push(sub.id);
    }
  }
  let mediaCleanup;
  try {
    mediaCleanup = await cleanupOrphanedMediaUploads(now);
  } catch (error) {
    console.error("[cron/monthly-credits] Media upload cleanup failed:", error);
    mediaCleanup = { error: true };
  }
  return NextResponse.json({ ok: failed.length === 0, granted, duplicates, ignored, failed, mediaCleanup });
}
