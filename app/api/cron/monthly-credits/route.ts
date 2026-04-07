import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credits";
import type { PlanKey } from "@/lib/plans";
import { addMonths } from "@/lib/subscription-sync";

export const dynamic = "force-dynamic";

/**
 * Yearly plans: grant months 2–12 (month 1 is handled by invoice.paid).
 * Secure with CRON_SECRET header or Vercel Cron.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const subs = await prisma.subscription.findMany({
    where: {
      billingCycle: "yearly",
      status: { in: ["active", "trialing"] },
      nextCreditAt: { lte: now },
    },
  });

  let granted = 0;
  const failed: string[] = [];

  for (const sub of subs) {
    if (!sub.nextCreditAt) continue;
    if (sub.nextCreditAt >= sub.currentPeriodEnd) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { nextCreditAt: null },
      });
      continue;
    }

    try {
      await grantCredits({
        userId: sub.userId,
        planType: sub.planType as PlanKey,
        source: "yearly_monthly_cron",
      });

      // Only advance nextCreditAt after a confirmed successful grant.
      const next = addMonths(sub.nextCreditAt, 1);
      const end = sub.currentPeriodEnd;
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          nextCreditAt: next.getTime() >= end.getTime() ? null : next,
        },
      });
      granted += 1;
    } catch (err) {
      // Grant failed: leave nextCreditAt unchanged so the next cron run retries.
      console.error(`[cron/monthly-credits] Failed to grant for sub ${sub.id}:`, err);
      failed.push(sub.id);
    }
  }

  return NextResponse.json({ ok: true, granted, failed });
}
