import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_SCOPE_HEADER, getAccountScope } from "@/lib/account-scope";
import { analyticsEnvironment, contextFromRequest, getAccountAnalyticsContext, serverMeasurementId } from "@/lib/analytics-server";
import { adsConsentKey, adsWithdrawalReceipt, consentEmailProof, enhancedConversionsEnabled, newAdsConsent, readAdsConsent, readAdsWithdrawalReceipt } from "@/lib/enhanced-conversions";
import { allowedAnalyticsHost } from "@/lib/analytics-policy";
import { analyticsCollectionPolicy } from "@/lib/analytics-collection-policy";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const sameOrigin = (request: Request) => request.headers.get("origin") === new URL(request.url).origin;
async function scopedSession(request: Request) {
  const session = await getServerSession(authOptions);
  return session?.user?.id && request.headers.get(ACCOUNT_SCOPE_HEADER) === getAccountScope(session.user) ? session : null;
}
export async function GET(request: Request) {
  if (!enhancedConversionsEnabled()) return reply({ enabled: false, granted: false });
  const session = await scopedSession(request);
  if (!session) return reply({ enabled: true, granted: false, verified: false });
  const row = await prisma.analyticsContext.findUnique({ where: { id: adsConsentKey(session.user.id) } });
  const consent = row?.accountCreatedAt.toISOString() === session.user.accountCreatedAt ? readAdsConsent(row.context) : null;
  const policy = analyticsCollectionPolicy(request.headers);
  const withdrawn = row?.accountCreatedAt.toISOString() === session.user.accountCreatedAt && typeof (row.context as { revokedAt?: number })?.revokedAt === "number";
  const permitted = !policy.gpc && !!consent && (consent.basis === "explicit" || consent.country === policy.country);
  return reply({ enabled: true, verified: session.user.emailVerified === true, granted: permitted && consent!.emailProof === consentEmailProof(session.user.email!),
    defaultAllowed: policy.defaultAdvertising === true && !policy.gpc && !withdrawn,
    basis: permitted ? consent!.basis : null,
    ...(consent ? { receipt: adsWithdrawalReceipt(session.user.id, session.user.accountCreatedAt, consent.token) } : {}) });
}
export async function POST(request: Request) {
  const requestedAt = Date.now();
  const id = serverMeasurementId();
  if (!sameOrigin(request) || !enhancedConversionsEnabled() || !id || !allowedAnalyticsHost(id, new URL(request.url).hostname)) return reply({ error: "Unavailable" }, 403);
  const session = await scopedSession(request);
  if (!session || !session.user.emailVerified) return reply({ error: "Sign in again to verify your email." }, 403);
  const body = await request.json().catch(() => null);
  const policy = analyticsCollectionPolicy(request.headers);
  const regional = body?.basis === "regional_default";
  if (body?.basis !== undefined && body.basis !== "explicit" && !regional) return reply({ error: "Invalid permission basis" }, 400);
  if (regional && (!policy.defaultAdvertising || !policy.country || policy.gpc)) return reply({ error: "Regional default unavailable" }, 403);
  const browserContext = contextFromRequest(request);
  if (body?.storage !== true || body?.userData !== true || !browserContext || request.headers.get("sec-gpc") === "1") return reply({ error: "Analytics permission required." }, 403);
  if (regional && browserContext?.collectionCountry !== policy.country) return reply({ error: "Refresh measurement context" }, 403);
  let consent = newAdsConsent(session.user.email!, regional ? policy.country! : undefined);
  // Receipt creation must succeed before persisting a grant.
  adsWithdrawalReceipt(session.user.id, session.user.accountCreatedAt, consent.token);
  const saved = await prisma.$transaction(async tx => {
    // Project a supported scalar; selecting the lock's void result breaks Prisma.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${adsConsentKey(session.user.id)}))`;
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.user.id} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.createdAt.toISOString() !== session.user.accountCreatedAt || user.email !== session.user.email) return false;
    const analytics = await getAccountAnalyticsContext(tx, user.id);
    if (!analytics || analytics.clientId !== browserContext.clientId) return false;
    const existing = await tx.analyticsContext.findUnique({ where: { id: adsConsentKey(user.id) } });
    const revokedAt = (existing?.context as { revokedAt?: number } | undefined)?.revokedAt;
    if (regional && existing?.accountCreatedAt.getTime() === user.createdAt.getTime() && typeof revokedAt === "number") return false;
    if (existing?.accountCreatedAt.getTime() === user.createdAt.getTime() && typeof revokedAt === "number" && revokedAt >= requestedAt) return false;
    const previous = existing?.accountCreatedAt.getTime() === user.createdAt.getTime() ? readAdsConsent(existing.context) : null;
    if (previous?.emailProof === consent.emailProof && (previous.basis === "explicit" || (regional && previous.country === consent.country))) consent = previous;
    await tx.analyticsContext.upsert({ where: { id: adsConsentKey(user.id) }, create: {
      id: adsConsentKey(user.id), userId: user.id, accountCreatedAt: user.createdAt, environment: analyticsEnvironment(), context: consent,
    }, update: { accountCreatedAt: user.createdAt, context: consent } });
    return true;
  });
  return saved ? reply({ granted: true, receipt: adsWithdrawalReceipt(session.user.id, session.user.accountCreatedAt, consent.token) }) : reply({ error: "Account changed" }, 409);
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "Forbidden" }, 403);
  const body = await request.json().catch(() => null);
  const receipt = readAdsWithdrawalReceipt(body?.receipt);
  const session = !receipt ? await scopedSession(request) : null;
  if (!receipt && !session) return reply({ error: "Sign in to complete withdrawal" }, 409);
  const target = receipt ?? { userId: session!.user.id, epoch: session!.user.accountCreatedAt, token: null };
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${adsConsentKey(target.userId)}))`;
    await tx.$queryRaw`SELECT "id" FROM "AnalyticsContext" WHERE "id" = ${adsConsentKey(target.userId)} FOR UPDATE`;
    const [stored, user] = await Promise.all([
      tx.analyticsContext.findUnique({ where: { id: adsConsentKey(target.userId) } }),
      tx.user.findUnique({ where: { id: target.userId } }),
    ]);
    if (!user || user.createdAt.toISOString() !== target.epoch) return;
    const grant = readAdsConsent(stored?.context);
    if (target.token && grant && grant.token !== target.token) return;
    const withdrawn = { purpose: "advertising_measurement", revokedAt: Date.now() };
    await tx.analyticsContext.upsert({ where: { id: adsConsentKey(user.id) }, create: {
      id: adsConsentKey(user.id), userId: user.id, accountCreatedAt: user.createdAt, environment: analyticsEnvironment(), context: withdrawn,
    }, update: { context: withdrawn, accountCreatedAt: user.createdAt } });
  });
  return reply({ ok: true });
}
