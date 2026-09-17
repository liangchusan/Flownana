import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { matchesRequestAccount } from "@/lib/account-scope";
import { prisma } from "@/lib/prisma";
import { persistOrReuseMediaInput } from "@/lib/media-assets";
import { inspectReference } from "@/lib/inspect-reference";
import { ProviderGenerationError } from "@/lib/generation-errors";

export const maxDuration = 60;
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !matchesRequestAccount(request, session.user)) return NextResponse.json({ error: "Sign in to choose references." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.url !== "string" || body.url.length > 2048 || !["image", "video", "audio"].includes(body.kind) || typeof body.asset !== "boolean") return NextResponse.json({ error: "Invalid reference." }, { status: 400 });
  const account = await prisma.user.findUnique({ where: { id: session.user.id }, select: { createdAt: true } });
  if (!account || account.createdAt.toISOString() !== session.user.accountCreatedAt) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  try {
    const generationWhere = { userId: session.user.id, status: "success", urls: { has: body.url }, type: body.kind === "audio" ? "music" : body.kind };
    if (body.asset && !await prisma.generation.findFirst({ where: generationWhere, select: { id: true } })) return NextResponse.json({ error: "This asset is no longer available. Choose another." }, { status: 404 });
    const owned = await persistOrReuseMediaInput({ source: body.url, kind: body.kind, userId: session.user.id, requestId: crypto.randomUUID() });
    // The maximum image model input is 30 MB; local uploads remain capped at 20 MB.
    const metadata = await inspectReference(owned.url, body.kind, (body.kind === "image" ? 30 : body.kind === "video" ? 50 : 15) * 1024 ** 2);
    const stillAccount = await prisma.user.findUnique({ where: { id: session.user.id }, select: { createdAt: true } });
    if (!stillAccount || stillAccount.createdAt.toISOString() !== session.user.accountCreatedAt || (body.asset && !await prisma.generation.findFirst({ where: generationWhere, select: { id: true } }))) return NextResponse.json({ error: "This reference is no longer available." }, { status: 409 });
    return NextResponse.json({ url: owned.url, ...metadata }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    const message = e instanceof ProviderGenerationError ? "Could not verify this media file." : "This file could not be checked. Retry or choose another file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
