import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { analyticsEnvironment, serverMeasurementId } from "./analytics-server";
import { auditAnalyticsPayments } from "./analytics-billing-audit";

const monitorId = () => `${analyticsEnvironment()}:analytics`;
export function analyticsAlertConfigured() {
  return process.env.VERCEL_ENV === "production" && !!process.env.ANALYTICS_ALERT_RESEND_KEY &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.ANALYTICS_ALERT_TO || "") &&
    /^[^\r\n]+@[^\s<>]+\.[^\s<>]+>?$/.test(process.env.ANALYTICS_ALERT_FROM || "");
}
export async function readAnalyticsHealth() {
  const now = Date.now();
  const environment = analyticsEnvironment();
  const [groups, delayedPurchases, attributionDeadline, state] = await Promise.all([
    prisma.analyticsReport.groupBy({ by: ["status"], where: { environment }, _count: { _all: true }, _min: { occurredAt: true } }),
    prisma.analyticsReport.count({ where: { environment, name: "purchase", status: { in: ["pending", "retry"] }, occurredAt: { lt: new Date(now - 600_000) } } }),
    prisma.analyticsReport.count({ where: { environment, name: "purchase", status: { in: ["pending", "retry"] },
      context: { path: ["sessionId"], lt: Math.floor(now / 1000) - 18 * 3600 } } }),
    prisma.analyticsMonitorState.findUnique({ where: { id: monitorId() } }),
  ]);
  const counts = Object.fromEntries(groups.map(group => [group.status, group._count._all]));
  const pendingTimes = groups.filter(group => ["pending", "retry"].includes(group.status)).map(group => group._min.occurredAt?.getTime()).filter((time): time is number => time !== undefined);
  const expectedMinutes = Number(process.env.ANALYTICS_RECOVERY_INTERVAL_MINUTES || "1440");
  const intervalMinutes = Number.isFinite(expectedMinutes) && expectedMinutes >= 5 && expectedMinutes <= 1440 ? expectedMinutes : 1440;
  const staleAfter = Math.max(15, intervalMinutes * 3);
  const coverage = state?.coverageAudit as Awaited<ReturnType<typeof auditAnalyticsPayments>> | null;
  const issues = [
    ...(delayedPurchases ? ["purchase_delayed"] : []),
    ...(attributionDeadline ? ["attribution_deadline"] : []),
    ...["invalid", "uncertain", "expired"].filter(status => counts[status] > 0),
    ...(coverage?.missing ? ["verified_payment_without_report"] : []),
    ...(coverage && (!coverage.complete || coverage.errors) ? ["coverage_audit_incomplete"] : []),
    ...(!state?.lastSuccessfulRunAt ? ["worker_not_verified"] : now - state.lastSuccessfulRunAt.getTime() > staleAfter * 60_000 ? ["worker_stale"] : []),
  ];
  return { enabled: !!serverMeasurementId() && !!process.env.GA_API_SECRET, environment, counts, delayedPurchases,
    attributionDeadline, oldestPendingSeconds: pendingTimes.length ? Math.max(0, Math.floor((now - Math.min(...pendingTimes)) / 1000)) : 0,
    lastSuccessfulRunAt: state?.lastSuccessfulRunAt?.toISOString() ?? null, expectedIntervalMinutes: intervalMinutes,
    coverageAudit: coverage, lastCoverageAuditAt: state?.lastCoverageAuditAt?.toISOString() ?? null,
    alertConfigured: analyticsAlertConfigured(), issues };
}
export async function refreshAnalyticsPaymentAudit() {
  if (!serverMeasurementId() || !process.env.STRIPE_SECRET_KEY) return;
  const state = await prisma.analyticsMonitorState.findUnique({ where: { id: monitorId() } });
  if (state?.lastCoverageAuditAt && Date.now() - state.lastCoverageAuditAt.getTime() < 15 * 60_000) return;
  const coverage = await auditAnalyticsPayments();
  const data = { lastCoverageAuditAt: new Date(), coverageAudit: coverage };
  await prisma.analyticsMonitorState.upsert({ where: { id: monitorId() }, create: { id: monitorId(), ...data }, update: data });
}
export async function recordAnalyticsRecoveryRun() {
  const data = { lastSuccessfulRunAt: new Date() };
  await prisma.analyticsMonitorState.upsert({ where: { id: monitorId() }, create: { id: monitorId(), ...data }, update: data });
}
export async function notifyAnalyticsHealth(health: Awaited<ReturnType<typeof readAnalyticsHealth>>, fetcher: typeof fetch = fetch) {
  if (!health.enabled) return { status: "disabled" };
  if (!analyticsAlertConfigured()) return { status: "not_configured" };
  const id = monitorId();
  const now = new Date();
  const signature = [...health.issues].sort().join(",");
  const state = await prisma.analyticsMonitorState.upsert({ where: { id }, create: { id }, update: {} });
  if (!signature && !state.notifiedSignature && !state.notificationKey) return { status: "healthy" };
  if (state.nextNotificationAt && state.nextNotificationAt > now) return { status: "cooldown" };
  const key = state.notificationKey || randomUUID();
  const messageSignature = state.notificationKey ? state.notificationSignature || signature : signature;
  const message = state.notificationPayload || { from: process.env.ANALYTICS_ALERT_FROM, to: [process.env.ANALYTICS_ALERT_TO],
    subject: signature ? "Flownana analytics needs attention" : "Flownana analytics recovered",
    text: JSON.stringify({ environment: health.environment, issues: health.issues, counts: health.counts,
      delayedPurchases: health.delayedPurchases, attributionDeadline: health.attributionDeadline,
      oldestPendingSeconds: health.oldestPendingSeconds, lastSuccessfulRunAt: health.lastSuccessfulRunAt,
      coverageAudit: health.coverageAudit }, null, 2) };
  const lease = new Date(now.getTime() + 60_000);
  const claimed = await prisma.analyticsMonitorState.updateMany({ where: { id,
    notificationKey: state.notificationKey, notifiedSignature: state.notifiedSignature,
    AND: [{ OR: [{ notificationLease: null }, { notificationLease: { lt: now } }] },
      { OR: [{ nextNotificationAt: null }, { nextNotificationAt: { lte: now } }] }] },
    data: { notificationKey: key, notificationPayload: message as Prisma.InputJsonValue, notificationSignature: messageSignature,
      notificationLease: lease, nextNotificationAt: new Date(now.getTime() + 60_000) } });
  if (!claimed.count) return { status: "busy" };
  // Only aggregate health goes to email. Provider responses/bodies and secrets are not logged.
  try {
    const response = await fetcher("https://api.resend.com/emails", { method: "POST", redirect: "error", signal: AbortSignal.timeout(5000),
      headers: { Authorization: `Bearer ${process.env.ANALYTICS_ALERT_RESEND_KEY}`, "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(message),
    });
    if (!response.ok) throw new Error("notification_unavailable");
    await prisma.analyticsMonitorState.updateMany({ where: { id, notificationKey: key, notificationLease: lease },
      data: { notifiedSignature: messageSignature || null, notificationKey: null, notificationPayload: Prisma.DbNull,
        notificationSignature: null, notificationLease: null,
        nextNotificationAt: messageSignature ? new Date(Date.now() + 30 * 60_000) : null } });
    return { status: "sent" };
  } catch {
    // Persist the same provider idempotency key when acceptance is uncertain.
    await prisma.analyticsMonitorState.updateMany({ where: { id, notificationKey: key, notificationLease: lease }, data: { notificationLease: null } });
    return { status: "delivery_failed" };
  }
}
