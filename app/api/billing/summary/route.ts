import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { matchesRequestAccount } from "@/lib/account-scope";
import { getBillingSummary } from "@/lib/billing-summary";
import { measureRequestStage, timedResponse } from "@/lib/request-timing";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return timedResponse("/api/billing/summary", async () => {
    const session = await measureRequestStage("auth", () => getServerSession(authOptions));
    if (!session?.user?.id || !matchesRequestAccount(request, session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(await measureRequestStage("billing", () => getBillingSummary(session.user.id, session.user.accountCreatedAt)));
  });
}
