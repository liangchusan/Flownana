import { NextResponse } from "next/server";
import { authorizedAnalyticsOperator } from "@/lib/analytics-recovery-policy";
import { readAnalyticsHealth } from "@/lib/analytics-monitor";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!authorizedAnalyticsOperator(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const health = await readAnalyticsHealth();
  return NextResponse.json(health, { status: !health.enabled || health.issues.length ? 503 : 200,
    headers: { "Cache-Control": "private, no-store" } });
}
