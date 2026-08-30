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
        select: { completedAt: true, expiresAt: true },
      });
      if (shouldDeleteOrphanedUpload({ uploadedAt: blob.uploadedAt, now, grant })) {
        await del(blob.url);
        deletedBlobs += 1;
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const cutoff = new Date(now.getTime() - MEDIA_UPLOAD_CALLBACK_GRACE_MS);
  const deleted = await prisma.mediaUploadGrant.deleteMany({
    where: { completedAt: null, expiresAt: { lt: cutoff } },
  });
  return { deletedBlobs, deletedGrants: deleted.count, skipped: false };
}
