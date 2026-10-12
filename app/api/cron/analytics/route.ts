import { NextResponse } from "next/server";
import { recoverAnalyticsReports } from "@/lib/analytics-server";
import { authorizedAnalyticsOperator } from "@/lib/analytics-recovery-policy";
import { notifyAnalyticsHealth, readAnalyticsHealth, recordAnalyticsRecoveryRun, refreshAnalyticsPaymentAudit } from "@/lib/analytics-monitor";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!authorizedAnalyticsOperator(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await recoverAnalyticsReports(28_000);
  if (!result.disabled) await recordAnalyticsRecoveryRun();
  await refreshAnalyticsPaymentAudit();
  const health = await readAnalyticsHealth();
  const notification = await notifyAnalyticsHealth(health);
  return NextResponse.json({ ...result, health, notification }, { headers: { "Cache-Control": "private, no-store" } });
}
