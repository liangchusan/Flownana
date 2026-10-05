import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { matchesRequestAccount } from "@/lib/account-scope";
import { ANALYTICS_COOKIE, allowedAnalyticsHost, validContext } from "@/lib/analytics-policy";
import { permitsAnalyticsContext } from "@/lib/analytics-collection-policy";
import { analyticsEnvironment, contextFromRequest, saveAnalyticsContext, scheduleAnalyticsReports, serverMeasurementId, signAnalyticsContext } from "@/lib/analytics-server";
export const dynamic = "force-dynamic";
function sameOrigin(request: Request) { return request.headers.get("origin") === new URL(request.url).origin; }
export async function POST(request: Request) {
  const id = serverMeasurementId();
  if (!sameOrigin(request) || !id || !allowedAnalyticsHost(id, new URL(request.url).hostname)) return NextResponse.json({ error: "Unavailable" }, { status: 403 });
  const context = validContext(await request.json().catch(() => null), id);
  if (!context) return NextResponse.json({ error: "Invalid context" }, { status: 400 });
  if (!permitsAnalyticsContext(request.headers, context.collectionBasis)) return NextResponse.json({ error: "Collection disabled" }, { status: 403 });
  // Timestamp is assigned by the server, never accepted as consent evidence from a future client clock.
  context.capturedAt = Date.now();
  const signature = signAnalyticsContext(context);
  if (!signature) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    if (!matchesRequestAccount(request, session.user)) return NextResponse.json({ error: "Account changed" }, { status: 409 });
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.user.id} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: session.user.id } });
      if (user && user.createdAt.toISOString() === session.user.accountCreatedAt) await saveAnalyticsContext(tx, user, context);
    });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ANALYTICS_COOKIE, signature, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", maxAge: 72 * 3600, path: "/" });
  if (session?.user?.id) scheduleAnalyticsReports();
  return response;
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const session = await getServerSession(authOptions);
  const context = contextFromRequest(request, true);
  // Withdrawal still applies to this browser's stored contexts after signing out.
  if (serverMeasurementId() && (session?.user?.id || context)) await prisma.$transaction(async tx => {
    const OR = [
      ...(session?.user?.id ? [{ userId: session.user.id }] : []),
      ...(context ? [{ context: { path: ["clientId"], equals: context.clientId } }] : []),
    ];
    const where = { environment: analyticsEnvironment(), OR };
    const affected = await tx.analyticsContext.findMany({ where, select: { userId: true }, distinct: ["userId"] });
    const userIds = new Set(affected.map(row => row.userId));
    if (session?.user?.id) userIds.add(session.user.id);
    for (const userId of [...userIds].sort()) await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    await tx.analyticsContext.deleteMany({ where });
    await tx.analyticsReport.updateMany({ where: { ...where, status: { in: ["pending", "retry", "uncertain", "sending"] } }, data: { status: "revoked", context: Prisma.DbNull, errorCode: "consent_revoked" } });
  });
  const response = NextResponse.json({ ok: true }); response.cookies.delete(ANALYTICS_COOKIE); return response;
}
