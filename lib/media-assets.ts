import { head } from "@vercel/blob";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUploadIdFromBlobUrl, MEDIA_UPLOAD_RULES, type MediaUploadKind } from "@/lib/media-upload-policy";
import {
  persistImageInputMedia,
  type StoredMedia,
} from "@/lib/media-storage";

export type MediaAssetRole = "input" | "output";
export type MediaAssetType = "image" | "video" | "music";

export interface GenerationMediaAsset {
  media: StoredMedia;
  role: MediaAssetRole;
  type: MediaAssetType;
  position: number;
}

async function resolveOwnedUpload(params: {
  source: string;
  userId: string;
  kind: MediaUploadKind;
}): Promise<StoredMedia | null> {
  const uploadId = getUploadIdFromBlobUrl(params.source);
  if (!uploadId) return null;
  const grant = await prisma.mediaUploadGrant.findFirst({
    where: { id: uploadId, userId: params.userId, kind: params.kind },
  });
  if (!grant || (grant.blobUrl && grant.blobUrl !== params.source)) return null;
  if (!grant.blobUrl && grant.expiresAt <= new Date()) {
    throw new Error("Input upload reservation has expired.");
  }

  const metadata = await head(params.source);
  const rule = MEDIA_UPLOAD_RULES[params.kind];
  if (metadata.size > grant.maxBytes || metadata.size > rule.max) {
    throw new Error(`Input ${params.kind} exceeds the maximum file size.`);
  }
  if (!rule.types.includes(metadata.contentType as never)) {
    throw new Error(`Input ${params.kind} file type is not supported.`);
  }
  const type = params.kind === "audio" ? "music" : params.kind;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "MediaUploadGrant" WHERE "id" = ${grant.id} FOR UPDATE`;
    const lockedGrant = await tx.mediaUploadGrant.findFirst({
      where: { id: grant.id, userId: params.userId, kind: params.kind },
    });
    if (!lockedGrant) throw new Error("Upload reservation was not found.");
    if (lockedGrant.blobUrl && lockedGrant.blobUrl !== params.source) {
      throw new Error("Upload reservation was already used.");
    }
    if (!lockedGrant.blobUrl && lockedGrant.expiresAt <= new Date()) {
      throw new Error("Input upload reservation has expired.");
    }
    await tx.mediaUploadGrant.update({
      where: { id: lockedGrant.id },
      data: {
        blobUrl: params.source,
        actualBytes: metadata.size,
        completedAt: lockedGrant.completedAt ?? new Date(),
      },
    });
    await tx.mediaAsset.upsert({
      where: { userId_url: { userId: params.userId, url: params.source } },
      update: { type, contentType: metadata.contentType, sizeBytes: metadata.size, origin: "uploaded" },
      create: {
        userId: params.userId,
        type,
        url: params.source,
        contentType: metadata.contentType,
        sizeBytes: metadata.size,
        origin: "uploaded",
      },
    });
  });
  return { url: params.source, contentType: metadata.contentType, sizeBytes: metadata.size };
}

export async function persistOrReuseImageInput(params: {
  source: string;
  userId: string;
  requestId: string;
}): Promise<StoredMedia> {
  const existing = await prisma.mediaAsset.findUnique({
    where: {
      userId_url: {
        userId: params.userId,
        url: params.source.trim(),
      },
    },
    select: {
      type: true,
      url: true,
      contentType: true,
      sizeBytes: true,
    },
  });

  if (existing?.type === "image") {
    return {
      url: existing.url,
      contentType: existing.contentType ?? undefined,
      sizeBytes: existing.sizeBytes ?? undefined,
    };
  }

  const upload = await resolveOwnedUpload({
    source: params.source.trim(),
    userId: params.userId,
    kind: "image",
  });
  if (upload) return upload;

  if (params.source.trim().startsWith("data:")) {
    throw new Error("Input images must use the authenticated upload flow.");
  }

  return persistImageInputMedia(params);
}

export async function persistOrReuseMediaInput(params: {
  source: string;
  userId: string;
  requestId: string;
  kind: "image" | "video" | "audio";
}): Promise<StoredMedia> {
  if (params.kind === "image") return persistOrReuseImageInput(params);

  const source = params.source.trim();
  const assetType = params.kind === "audio" ? "music" : "video";
  const existing = await prisma.mediaAsset.findUnique({
    where: { userId_url: { userId: params.userId, url: source } },
    select: { type: true, url: true, contentType: true, sizeBytes: true },
  });
  if (existing?.type === assetType) {
    return {
      url: existing.url,
      contentType: existing.contentType ?? undefined,
      sizeBytes: existing.sizeBytes ?? undefined,
    };
  }

  const upload = await resolveOwnedUpload({
    source,
    userId: params.userId,
    kind: params.kind,
  });
  if (upload) return upload;
  throw new Error(`Input ${params.kind} must come from an owned upload or asset.`);
}

export async function syncGenerationMediaAssets(params: {
  generationId: string;
  userId: string;
  assets: GenerationMediaAsset[];
  tx?: Prisma.TransactionClient;
}) {
  if (params.assets.length === 0) return;

  const sync = async (tx: Prisma.TransactionClient) => {
    for (const item of params.assets) {
      const asset = await tx.mediaAsset.upsert({
        where: {
          userId_url: {
            userId: params.userId,
            url: item.media.url,
          },
        },
        update: {
          type: item.type,
          contentType: item.media.contentType,
          sizeBytes: item.media.sizeBytes,
        },
        create: {
          userId: params.userId,
          type: item.type,
          url: item.media.url,
          contentType: item.media.contentType,
          sizeBytes: item.media.sizeBytes,
          origin: item.role === "input" ? "uploaded" : "generated",
        },
      });

      await tx.generationMedia.upsert({
        where: {
          generationId_mediaAssetId_role: {
            generationId: params.generationId,
            mediaAssetId: asset.id,
            role: item.role,
          },
        },
        update: { position: item.position },
        create: {
          generationId: params.generationId,
          mediaAssetId: asset.id,
          role: item.role,
          position: item.position,
        },
      });
    }
  };

  if (params.tx) await sync(params.tx);
  else await prisma.$transaction(sync);
}
