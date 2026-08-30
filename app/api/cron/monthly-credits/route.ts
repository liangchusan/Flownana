import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getPriceKeyFromStripePriceId,
  PLAN_CREDITS,
} from "@/lib/plans";
import {
  getDueYearlyCreditGrantDates,
  getNextYearlyCreditAt,
  getYearlyCreditGrantKey,
} from "@/lib/yearly-credit-schedule";
import { cleanupOrphanedMediaUploads } from "@/lib/media-upload-cleanup";
import { canCreateStripeCheckout } from "@/lib/stripe-production-access";

export const dynamic = "force-dynamic";
const MS_PER_DAY = 86_400_000;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

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
    include: { user: { select: { email: true } } },
  });

  let granted = 0;
  let duplicates = 0;
  let ignored = 0;
  const failed: string[] = [];

  for (const sub of subs) {
    if (
      !canCreateStripeCheckout({
        email: sub.user.email,
        secretKey: process.env.STRIPE_SECRET_KEY,
        vercelEnv: process.env.VERCEL_ENV,
        allowedEmails: process.env.STRIPE_TEST_MODE_ALLOWED_EMAILS,
      })
    ) {
      ignored += 1;
      continue;
    }

    const parsed = getPriceKeyFromStripePriceId(sub.stripePriceId);
    if (!parsed || parsed.billing !== "yearly") {
      console.error(
        `[cron/monthly-credits] Unrecognized yearly price ${sub.stripePriceId}`
      );
      failed.push(sub.id);
      continue;
    }

    const dueDates = getDueYearlyCreditGrantDates({
      nextCreditAt: sub.nextCreditAt,
      currentPeriodEnd: sub.currentPeriodEnd,
      now,
    });
    if (dueDates.length === 0) continue;

    for (const dueDate of dueDates) {
      const grantKey = getYearlyCreditGrantKey(sub.id, dueDate);
      const nextCreditAt = getNextYearlyCreditAt({
        lastDueCreditAt: dueDate,
        currentPeriodEnd: sub.currentPeriodEnd,
      });

      try {
        await prisma.$transaction(async (tx) => {
          await tx.processedStripeEvent.create({
            data: { id: grantKey, type: "yearly_monthly_credit_grant" },
          });

          const amount = PLAN_CREDITS[parsed.plan];
          await tx.creditBatch.create({
            data: {
              userId: sub.userId,
              amount,
              remaining: amount,
              expiresAt: new Date(Date.now() + 30 * MS_PER_DAY),
              source: "yearly_monthly_cron",
            },
          });

          await tx.subscription.update({
            where: { id: sub.id },
            data: { nextCreditAt },
          });
        });
        granted += 1;
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          duplicates += 1;
          continue;
        }

        console.error(
          `[cron/monthly-credits] Failed to grant ${grantKey}:`,
          err
        );
        failed.push(sub.id);
        break;
      }
    }
  }

  let mediaCleanup;
  try {
    mediaCleanup = await cleanupOrphanedMediaUploads(now);
  } catch (error) {
    console.error("[cron/monthly-credits] Media upload cleanup failed:", error);
    mediaCleanup = { error: true };
  }

  return NextResponse.json({
    ok: true,
    granted,
    duplicates,
    ignored,
    failed,
    mediaCleanup,
  });
}
