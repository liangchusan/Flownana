import { prisma } from "@/lib/prisma";
import { MEDIA_UPLOAD_BYTES_PER_DAY, MEDIA_UPLOAD_GRANTS_PER_HOUR, MEDIA_UPLOAD_TOTAL_BYTES, MEDIA_UPLOAD_TOKEN_TTL_MS } from "./media-upload-policy";

export class MediaUploadRateLimitError extends Error {}
export async function reserveMediaUpload(userId: string, payload: { uploadId: string; kind: string; sizeBytes: number }, accountCreatedAt?: string, pathname?: string) {
  const now = new Date();
  return prisma.$transaction(async tx => {
    // Avatar writes, reference grants and account deletion share this physical lock.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    if (!user || (accountCreatedAt && user.createdAt.toISOString() !== accountCreatedAt)) throw new Error("Account changed.");
    const kinds = { in: ["image", "video", "audio", "avatar"] };
    const [hourly, daily, total] = await Promise.all([
      tx.mediaUploadGrant.count({ where: { userId, kind: kinds, createdAt: { gte: new Date(now.getTime() - 3600_000) } } }),
      tx.mediaUploadGrant.aggregate({ where: { userId, kind: kinds, createdAt: { gte: new Date(now.getTime() - 86400_000) } }, _sum: { maxBytes: true } }),
      tx.mediaUploadGrant.aggregate({ where: { userId, kind: kinds,
        AND: [{ OR: [{ kind: { not: "avatar" } }, { actualBytes: null }, { actualBytes: { gt: 0 } }] },
          { OR: [{ completedAt: { not: null } }, { expiresAt: { gt: now } }] }] }, _sum: { maxBytes: true } }),
    ]);
    if (hourly >= MEDIA_UPLOAD_GRANTS_PER_HOUR || (daily._sum.maxBytes ?? 0) + payload.sizeBytes > MEDIA_UPLOAD_BYTES_PER_DAY ||
        (total._sum.maxBytes ?? 0) + payload.sizeBytes > MEDIA_UPLOAD_TOTAL_BYTES) throw new MediaUploadRateLimitError("Upload quota exceeded.");
    return tx.mediaUploadGrant.create({ data: { id: payload.uploadId, userId, kind: payload.kind, maxBytes: payload.sizeBytes,
      ...(pathname ? { blobUrl: pathname } : {}), expiresAt: new Date(now.getTime() + MEDIA_UPLOAD_TOKEN_TTL_MS) } });
  });
}
