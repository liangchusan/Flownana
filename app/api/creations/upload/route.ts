import { getServerSession } from "next-auth";
import { head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { matchesRequestAccount } from "@/lib/account-scope";
import { prisma } from "@/lib/prisma";
import { reserveMediaUpload, MediaUploadRateLimitError } from "@/lib/upload-reservation";
import {
  MEDIA_UPLOAD_RULES,
  MEDIA_UPLOAD_TOKEN_TTL_MS,
  parseMediaUploadPayload,
  getUploadIdFromBlobUrl,
} from "@/lib/media-upload-policy";

async function completeUpload(blobUrl: string, tokenPayload?: string | null) {
  const payload = parseMediaUploadPayload(tokenPayload ?? null);
  if (getUploadIdFromBlobUrl(blobUrl) !== payload.uploadId) throw new Error("Upload path does not match its reservation.");
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
        if (!pathname.startsWith(`generation-inputs/${payload.kind}/${payload.uploadId}/`) || pathname.split("/").length !== 4 || !pathname.split("/")[3] || [".", ".."].includes(pathname.split("/")[3])) throw new Error("Invalid upload request.");
        await reserveMediaUpload(session.user.id, payload, session.user.accountCreatedAt);
        const rule = MEDIA_UPLOAD_RULES[payload.kind];
        return {
          allowedContentTypes: [...rule.types],
          maximumSizeInBytes: payload.sizeBytes,
          addRandomSuffix: false,
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
