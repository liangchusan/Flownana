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

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error(`Input ${params.kind} URL is invalid.`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Input ${params.kind} must be a public URL.`);
  }
  const response = await fetch(source, { method: "HEAD" });
  if (!response.ok) throw new Error(`Input ${params.kind} is unavailable.`);
  const contentType = response.headers.get("content-type")?.split(";")[0];
  const sizeBytes = Number(response.headers.get("content-length") || 0) || undefined;
  if (contentType && !contentType.startsWith(`${params.kind}/`)) {
    throw new Error(`Input ${params.kind} file type is not supported.`);
  }
  const maxBytes = params.kind === "video" ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
  if (sizeBytes && sizeBytes > maxBytes) {
    throw new Error(`Input ${params.kind} exceeds the maximum file size.`);
  }
  return { url: source, contentType, sizeBytes };
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
