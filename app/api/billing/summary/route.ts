import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getCreditSummary } from "@/lib/credits";
import { PLAN_RESOLUTION, PLAN_CREDITS } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ["active", "trialing"] },
    },
    orderBy: { createdAt: "desc" },
  });

  const credits = await getCreditSummary(userId);

  return NextResponse.json({
    subscription: sub
      ? {
          planType: sub.planType,
          billingCycle: sub.billingCycle,
          status: sub.status,
          resolution: PLAN_RESOLUTION[sub.planType as "pro" | "max"],
          creditsPerMonth: PLAN_CREDITS[sub.planType as "pro" | "max"],
          currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          nextPlan: sub.nextPlan,
        }
      : null,
    credits: {
      current: credits.total,
      expiringSoon: credits.expiringSoon,
      expiringInDays: credits.expiringInDays,
    },
  });
}
