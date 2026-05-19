import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credits";
import type { PlanKey } from "@/lib/plans";
import {
  getDueYearlyCreditGrantDates,
  getNextYearlyCreditAt,
} from "@/lib/yearly-credit-schedule";

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
    const dueDates = getDueYearlyCreditGrantDates({
      nextCreditAt: sub.nextCreditAt,
      currentPeriodEnd: sub.currentPeriodEnd,
      now,
    });
    if (dueDates.length === 0) continue;

    try {
      for (const dueDate of dueDates) {
        await grantCredits({
          userId: sub.userId,
          planType: sub.planType as PlanKey,
          source: "yearly_monthly_cron",
        });
        granted += 1;
      }

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          nextCreditAt: getNextYearlyCreditAt({
            lastDueCreditAt: dueDates[dueDates.length - 1],
            currentPeriodEnd: sub.currentPeriodEnd,
          }),
        },
      });
    } catch (err) {
      // Grant failed: leave nextCreditAt unchanged so the next cron run retries.
      console.error(`[cron/monthly-credits] Failed to grant for sub ${sub.id}:`, err);
      failed.push(sub.id);
    }
  }

  return NextResponse.json({ ok: true, granted, failed });
}
