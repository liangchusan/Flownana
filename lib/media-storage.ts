import { put } from "@vercel/blob";

type MediaKind = "image" | "video" | "music";

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
};

const FALLBACK_EXTENSION_BY_KIND: Record<MediaKind, string> = {
  image: "png",
  video: "mp4",
  music: "mp3",
};

function extensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    return match?.[1]?.toLowerCase() || null;
  } catch {
    return null;
  }
}

function extensionFor(params: {
  contentType: string | null;
  sourceUrl: string;
  kind: MediaKind;
}) {
  const normalizedContentType = params.contentType?.split(";")[0]?.toLowerCase();
  return (
    (normalizedContentType && EXTENSION_BY_CONTENT_TYPE[normalizedContentType]) ||
    extensionFromUrl(params.sourceUrl) ||
    FALLBACK_EXTENSION_BY_KIND[params.kind]
  );
}

function isExpectedContentType(kind: MediaKind, contentType: string | null) {
  const normalizedContentType = contentType?.split(";")[0]?.toLowerCase();
  if (!normalizedContentType) return true;

  if (kind === "image") return normalizedContentType.startsWith("image/");
  if (kind === "video") return normalizedContentType.startsWith("video/");
  return normalizedContentType.startsWith("audio/");
}

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96) || "unknown";
}

export async function persistGeneratedMedia(params: {
  sourceUrl: string;
  userId: string;
  taskId: string;
  kind: MediaKind;
}): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is not configured; using provider URL.");
    return params.sourceUrl;
  }

  try {
    const response = await fetch(params.sourceUrl);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download media: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (!isExpectedContentType(params.kind, contentType)) {
      throw new Error(
        `Unexpected ${params.kind} content type while downloading generated media: ${contentType}`
      );
    }

    const extension = extensionFor({
      contentType,
      sourceUrl: params.sourceUrl,
      kind: params.kind,
    });
    const pathname = [
      "generations",
      safePathSegment(params.userId),
      params.kind,
      `${safePathSegment(params.taskId)}.${extension}`,
    ].join("/");

    const blob = await put(pathname, response.body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: contentType || undefined,
      multipart: true,
    });

    return blob.url;
  } catch (error) {
    console.error("Failed to persist generated media to Vercel Blob:", error);
    return params.sourceUrl;
  }
}
