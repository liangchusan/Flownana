import { prisma } from "@/lib/prisma";
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

  return persistImageInputMedia(params);
}

export async function syncGenerationMediaAssets(params: {
  generationId: string;
  userId: string;
  assets: GenerationMediaAsset[];
}) {
  if (params.assets.length === 0) return;

  await prisma.$transaction(async (tx) => {
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
  });
}
