import { del, list } from "@vercel/blob";
import {
  getUploadIdFromBlobUrl,
  MEDIA_UPLOAD_CALLBACK_GRACE_MS,
  shouldDeleteOrphanedUpload,
} from "@/lib/media-upload-policy";
import { prisma } from "@/lib/prisma";

export async function cleanupOrphanedMediaUploads(now = new Date()) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { deletedBlobs: 0, deletedGrants: 0, skipped: true };
  let cursor: string | undefined;
  let deletedBlobs = 0;
  do {
    const page = await list({ prefix: "generation-inputs/", cursor, limit: 1000 });
    for (const blob of page.blobs) {
      const uploadId = getUploadIdFromBlobUrl(blob.url);
      if (!uploadId) continue;
      const grant = await prisma.mediaUploadGrant.findUnique({
        where: { id: uploadId },
        select: { completedAt: true, expiresAt: true, blobUrl: true },
      });
      if (shouldDeleteOrphanedUpload({ uploadedAt: blob.uploadedAt, now, grant }) ||
          (now.getTime() - blob.uploadedAt.getTime() >= MEDIA_UPLOAD_CALLBACK_GRACE_MS && grant?.completedAt && grant.blobUrl !== blob.url)) {
        await del(blob.url);
        deletedBlobs += 1;
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  // Includes pre-fix orphans and interrupted writes; the currently selected avatar is authoritative.
  cursor = undefined;
  do {
    const page: Awaited<ReturnType<typeof list>> = await list({ prefix: "avatars/", cursor, limit: 1000 });
    for (const blob of page.blobs) {
      if (now.getTime() - blob.uploadedAt.getTime() < MEDIA_UPLOAD_CALLBACK_GRACE_MS) continue;
      const selected = await prisma.user.findFirst({ where: { customAvatarUrl: blob.url }, select: { id: true } });
      if (!selected) {
        await del(blob.url); deletedBlobs++;
        await prisma.mediaUploadGrant.updateMany({ where: { kind: "avatar", blobUrl: blob.url }, data: { actualBytes: 0 } });
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  // A Blob delete can succeed before the quota update fails. Retry from durable
  // grants too, because such an already-deleted file is absent from list().
  let grantCursor: string | undefined;
  do {
    const grants = await prisma.mediaUploadGrant.findMany({ where: { kind: "avatar", completedAt: { not: null }, actualBytes: { gt: 0 } },
      orderBy: { id: "asc" }, take: 1000, ...(grantCursor ? { cursor: { id: grantCursor }, skip: 1 } : {}) });
    for (const grant of grants) {
      if (!grant.blobUrl || await prisma.user.findFirst({ where: { customAvatarUrl: grant.blobUrl }, select: { id: true } })) continue;
      await del(grant.blobUrl);
      await prisma.mediaUploadGrant.updateMany({ where: { id: grant.id, blobUrl: grant.blobUrl }, data: { actualBytes: 0 } });
    }
    grantCursor = grants.length === 1000 ? grants.at(-1)!.id : undefined;
  } while (grantCursor);

  const cutoff = new Date(now.getTime() - MEDIA_UPLOAD_CALLBACK_GRACE_MS);
  const deleted = await prisma.mediaUploadGrant.deleteMany({
    where: { expiresAt: { lt: cutoff }, OR: [{ completedAt: null }, { kind: "inspection" }, { kind: "avatar", actualBytes: 0 }] },
  });
  return { deletedBlobs, deletedGrants: deleted.count, skipped: false };
}
