import { getServerSession } from "next-auth";
import { head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { matchesRequestAccount } from "@/lib/account-scope";
import { prisma } from "@/lib/prisma";
import {
  MEDIA_UPLOAD_BYTES_PER_DAY,
  MEDIA_UPLOAD_GRANTS_PER_HOUR,
  MEDIA_UPLOAD_RULES,
  MEDIA_UPLOAD_TOKEN_TTL_MS,
  MEDIA_UPLOAD_TOTAL_BYTES,
  parseMediaUploadPayload,
  type MediaUploadPayload,
} from "@/lib/media-upload-policy";

class MediaUploadRateLimitError extends Error {}

async function reserveUpload(userId: string, payload: MediaUploadPayload) {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
    const [hourlyCount, dailyBytes, totalReservedBytes] = await Promise.all([
      tx.mediaUploadGrant.count({ where: { userId, createdAt: { gte: hourAgo } } }),
      tx.mediaUploadGrant.aggregate({
        where: { userId, createdAt: { gte: dayAgo } },
        _sum: { maxBytes: true },
      }),
      tx.mediaUploadGrant.aggregate({
        where: {
          userId,
          OR: [{ completedAt: { not: null } }, { expiresAt: { gt: now } }],
        },
        _sum: { maxBytes: true },
      }),
    ]);
    if (
      hourlyCount >= MEDIA_UPLOAD_GRANTS_PER_HOUR ||
      (dailyBytes._sum.maxBytes ?? 0) + payload.sizeBytes > MEDIA_UPLOAD_BYTES_PER_DAY ||
      (totalReservedBytes._sum.maxBytes ?? 0) + payload.sizeBytes > MEDIA_UPLOAD_TOTAL_BYTES
    ) throw new MediaUploadRateLimitError("Upload quota exceeded.");
    await tx.mediaUploadGrant.create({
      data: {
        id: payload.uploadId,
        userId,
        kind: payload.kind,
        maxBytes: payload.sizeBytes,
        expiresAt: new Date(now.getTime() + MEDIA_UPLOAD_TOKEN_TTL_MS),
      },
    });
  });
}

async function completeUpload(blobUrl: string, tokenPayload?: string | null) {
  const payload = parseMediaUploadPayload(tokenPayload ?? null);
  const metadata = await head(blobUrl);
  if (metadata.size > payload.sizeBytes) throw new Error("Completed upload exceeds its reservation.");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "MediaUploadGrant" WHERE "id" = ${payload.uploadId} FOR UPDATE`;
    const grant = await tx.mediaUploadGrant.findUnique({ where: { id: payload.uploadId } });
    if (!grant || grant.kind !== payload.kind || grant.maxBytes !== payload.sizeBytes) {
      throw new Error("Upload reservation was not found.");
    }
    if (grant.blobUrl && grant.blobUrl !== blobUrl) throw new Error("Upload reservation was already used.");
    await tx.mediaUploadGrant.update({
      where: { id: grant.id },
      data: {
        blobUrl,
        actualBytes: metadata.size,
        completedAt: grant.completedAt ?? new Date(),
      },
    });
    await tx.mediaAsset.upsert({
      where: { userId_url: { userId: grant.userId, url: blobUrl } },
      update: {
        type: payload.kind === "audio" ? "music" : payload.kind,
        contentType: metadata.contentType,
        sizeBytes: metadata.size,
        origin: "uploaded",
      },
      create: {
        userId: grant.userId,
        type: payload.kind === "audio" ? "music" : payload.kind,
        url: blobUrl,
        contentType: metadata.contentType,
        sizeBytes: metadata.size,
        origin: "uploaded",
      },
    });
  });
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Upload storage is not configured." }, { status: 503 });

  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || !matchesRequestAccount(request, session.user)) throw new Error("Authentication required.");
        const payload = parseMediaUploadPayload(clientPayload);
        if (!pathname.startsWith(`generation-inputs/${payload.kind}/${payload.uploadId}/`)) throw new Error("Invalid upload request.");
        await reserveUpload(session.user.id, payload);
        const rule = MEDIA_UPLOAD_RULES[payload.kind];
        return {
          allowedContentTypes: [...rule.types],
          maximumSizeInBytes: payload.sizeBytes,
          addRandomSuffix: true,
          allowOverwrite: false,
          validUntil: Date.now() + MEDIA_UPLOAD_TOKEN_TTL_MS,
          tokenPayload: JSON.stringify(payload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => completeUpload(blob.url, tokenPayload),
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Input media upload failed:", error);
    const rateLimited = error instanceof MediaUploadRateLimitError;
    return NextResponse.json(
      { error: rateLimited ? "Upload quota exceeded." : "Upload failed." },
      { status: rateLimited ? 429 : 400 }
    );
  }
}
