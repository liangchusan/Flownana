import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { permitsAnalyticsContext } from "./analytics-collection-policy";
import { ANALYTICS_COOKIE, CONTEXT_MAX_AGE_MS, measurementIdForEnvironment, TEST_GA_ID, validContext, type AnalyticsContext } from "./analytics-policy";
export { ANALYTICS_COOKIE };
export function serverMeasurementId() {
  return process.env.NEXT_PUBLIC_GA_ENABLED === "true" ? measurementIdForEnvironment(process.env.VERCEL_ENV, process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) : null;
}
export function analyticsEnvironment() { return process.env.VERCEL_ENV === "production" ? "production" : "test"; }
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export function signAnalyticsContext(context: AnalyticsContext) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const body = Buffer.from(JSON.stringify(context)).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
export function readAnalyticsContext(value?: string | null) {
  const id = serverMeasurementId(), secret = process.env.NEXTAUTH_SECRET;
  if (!id || !secret || !value || value.length > 1000) return null;
  try {
    const [body, sig, extra] = value.split(".");
    if (extra || !body || !sig) return null;
    const expected = createHmac("sha256", secret).update(body).digest();
    const actual = Buffer.from(sig, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    return validContext(JSON.parse(Buffer.from(body, "base64url").toString()), id);
  } catch { return null; }
}
export function contextFromRequest(request: Request, withdrawal = false) {
  const cookie = request.headers.get("cookie")?.split(";").map(c => c.trim()).find(c => c.startsWith(`${ANALYTICS_COOKIE}=`));
  const context = readAnalyticsContext(cookie?.slice(ANALYTICS_COOKIE.length + 1));
  return context && (withdrawal || permitsAnalyticsContext(request.headers, context.collectionBasis)) ? context : null;
}
export function contextKey(userId: string, subject = "account") { return `${analyticsEnvironment()}:${userId}:${subject}`; }
export async function saveAnalyticsContext(tx: Prisma.TransactionClient, user: { id: string; createdAt: Date }, context: AnalyticsContext, subject = "account") {
  const id = serverMeasurementId();
  if (!id || !validContext(context, id)) return;
  await tx.analyticsContext.upsert({ where: { id: contextKey(user.id, subject) }, create: {
    id: contextKey(user.id, subject), userId: user.id, accountCreatedAt: user.createdAt, environment: analyticsEnvironment(), context: json(context),
  }, update: subject === "account" ? { context: json(context), accountCreatedAt: user.createdAt } : {} });
}
export async function getAccountAnalyticsContext(tx: Prisma.TransactionClient, userId: string, subject = "account") {
  const id = serverMeasurementId();
  if (!id) return null;
  const stored = await tx.analyticsContext.findUnique({ where: { id: contextKey(userId, subject) } });
  const user = stored ? await tx.user.findUnique({ where: { id: userId }, select: { createdAt: true } }) : null;
  return user && user.createdAt.getTime() === stored!.accountCreatedAt.getTime() ? validContext(stored!.context, id) : null;
}
export async function queueAnalyticsReport(tx: Prisma.TransactionClient, input: {
  userId: string; key: string; name: "sign_up" | "purchase" | "generation_completed";
  params: Record<string, unknown>; context: AnalyticsContext | null; occurredAt?: Date;
}) {
  const measurement = serverMeasurementId();
  if (!measurement) return;
  const context = validContext(input.context, measurement);
  const id = `${analyticsEnvironment()}:${input.name}:${input.key}`;
  const inserted = await tx.analyticsReport.createMany({ skipDuplicates: true, data: {
    id, userId: input.userId, environment: analyticsEnvironment(), name: input.name, params: json(input.params),
    ...(context ? { context: json(context) } : {}), occurredAt: input.occurredAt || new Date(),
    nextAttemptAt: new Date(), createdAt: new Date(),
    status: context ? "pending" : "missing_context", errorCode: context ? null : "no_consented_context",
  } });
  if (inserted.count && context) scheduleAnalyticsReports();
}
// Network delivery starts after the response/transaction; Cron remains the recovery path.
export function scheduleAnalyticsReports() {
  if (!serverMeasurementId() || !process.env.GA_API_SECRET || typeof after !== "function") return;
  try {
    after(async () => {
      try { await flushAnalyticsReports(5); }
      catch { console.error("GA delivery deferred to recovery worker"); }
    });
  } catch { /* No Next request context (e.g. maintenance scripts): use the durable worker. */ }
}
// 2xx is transport acknowledgement, NOT proof of inclusion in GA reports.
export async function flushAnalyticsReports(limit = 20, fetcher: typeof fetch = fetch) {
  const id = serverMeasurementId(), secret = process.env.GA_API_SECRET;
  if (!id || !secret) return { transmitted: 0, disabled: true };
  const now = new Date();
  await prisma.analyticsReport.updateMany({ where: { environment: analyticsEnvironment(), status: "sending", leaseUntil: { lt: now } }, data: { status: "uncertain", errorCode: "worker_interrupted", leaseUntil: null } });
  const reports = await prisma.analyticsReport.findMany({ where: { environment: analyticsEnvironment(), status: { in: ["pending", "retry"] },
    nextAttemptAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, orderBy: { occurredAt: "asc" }, take: Math.min(limit, 50) });
  let transmitted = 0;
  for (const report of reports) {
    if (Date.now() - now.getTime() > 40_000) break;
    const leaseUntil = new Date(Date.now() + 30_000);
    const claim = await prisma.analyticsReport.updateMany({ where: { id: report.id, status: { in: ["pending", "retry"] },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, data: { status: "sending", leaseUntil, attempts: { increment: 1 } } });
    if (!claim.count) continue;
    const context = validContext(report.context, id);
    if (!context || Date.now() - report.occurredAt.getTime() >= CONTEXT_MAX_AGE_MS) {
      await prisma.analyticsReport.updateMany({ where: { id: report.id, leaseUntil, status: "sending" }, data: { status: "expired", leaseUntil: null, errorCode: "stale_context_or_event" } }); continue;
    }
    const payload = { client_id: context.clientId, timestamp_micros: report.occurredAt.getTime() * 1000,
      consent: { ad_user_data: "DENIED", ad_personalization: "DENIED" }, events: [{ name: report.name,
        params: { ...(report.params as Prisma.JsonObject), session_id: context.sessionId, engagement_time_msec: 1,
          ...(id === TEST_GA_ID ? { debug_mode: true } : {}) } }] };
    let status = "retry", errorCode: string | null = null;
    try {
      const response = await fetcher(`https://www.google-analytics.com/mp/collect?measurement_id=${id}&api_secret=${encodeURIComponent(secret)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8_000), redirect: "error",
      });
      if (response.ok) { status = "transmitted"; transmitted++; }
      else if (response.status === 429) errorCode = "rate_limited";
      else if (response.status >= 500) { status = "uncertain"; errorCode = "remote_uncertain"; }
      else { status = "invalid"; errorCode = `http_${response.status}`; }
    } catch { status = "uncertain"; errorCode = "network_uncertain"; }
    // Unknown acceptance is quarantined rather than blindly resending a signup/output.
    await prisma.analyticsReport.updateMany({ where: { id: report.id, leaseUntil, status: "sending" }, data: {
      status, errorCode, leaseUntil: null, nextAttemptAt: new Date(Date.now() + Math.min(60_000 * 2 ** report.attempts, 3_600_000)),
      ...(status === "transmitted" ? { transmittedAt: new Date() } : {}),
    } });
  }
  return { transmitted, disabled: false };
}
