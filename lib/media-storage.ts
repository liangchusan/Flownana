import { put } from "@vercel/blob";

type MediaKind = "image" | "video" | "music";
export interface StoredMedia {
  url: string;
  contentType?: string;
  sizeBytes?: number;
}
const MAX_INPUT_IMAGE_BYTES = 20 * 1024 * 1024;

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

function parseDataUrl(value: string): {
  bytes: Buffer;
  contentType: string;
} | null {
  const match = value.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!match) return null;

  const contentType = match[1].toLowerCase();
  const isBase64 = !!match[2];
  const payload = match[3];
  const bytes = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");

  return { bytes, contentType };
}

export async function persistGeneratedMedia(params: {
  sourceUrl: string;
  userId: string;
  taskId: string;
  kind: MediaKind;
}): Promise<StoredMedia> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Generated media storage is not configured.");
  }

  try {
    const response = await fetch(params.sourceUrl);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download media: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    const contentLength = Number(response.headers.get("content-length") || 0);
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

    return {
      url: blob.url,
      contentType: contentType?.split(";")[0] || undefined,
      sizeBytes: contentLength > 0 ? contentLength : undefined,
    };
  } catch (error) {
    console.error("Failed to persist generated media to Vercel Blob:", error);
    throw new Error("Failed to persist generated media.");
  }
}

export async function persistImageInputMedia(params: {
  source: string;
  userId: string;
  requestId: string;
}): Promise<StoredMedia> {
  const source = params.source.trim();
  if (!source) {
    throw new Error("Input image is empty.");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (source.startsWith("http://") || source.startsWith("https://")) {
      return { url: source };
    }
    throw new Error("Image upload storage is not configured.");
  }

  let body: Blob | ReadableStream<Uint8Array>;
  let contentType: string | null = null;
  let sizeBytes: number | undefined;
  let sourceForExtension = source;

  const dataUrl = parseDataUrl(source);
  if (dataUrl) {
    if (dataUrl.bytes.byteLength > MAX_INPUT_IMAGE_BYTES) {
      throw new Error("Input image exceeds the maximum file size of 20 MB.");
    }
    body = new Blob([new Uint8Array(dataUrl.bytes)], {
      type: dataUrl.contentType,
    });
    contentType = dataUrl.contentType;
    sizeBytes = dataUrl.bytes.byteLength;
    sourceForExtension = `input.${extensionFor({
      contentType,
      sourceUrl: "input.png",
      kind: "image",
    })}`;
  } else {
    let url: URL;
    try {
      url = new URL(source);
    } catch {
      throw new Error("Input image URL is invalid.");
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Input image URL must be a public image URL.");
    }

    const response = await fetch(source);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download input image: ${response.status}`);
    }

    contentType = response.headers.get("content-type");
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_INPUT_IMAGE_BYTES) {
      throw new Error("Input image exceeds the maximum file size of 20 MB.");
    }
    body = response.body;
    sizeBytes = contentLength > 0 ? contentLength : undefined;
  }

  if (!isExpectedContentType("image", contentType)) {
    throw new Error(`Input image file type is not supported: ${contentType || "unknown"}`);
  }

  const extension = extensionFor({
    contentType,
    sourceUrl: sourceForExtension,
    kind: "image",
  });
  const pathname = [
    "generation-inputs",
    safePathSegment(params.userId),
    `${safePathSegment(params.requestId)}.${extension}`,
  ].join("/");

  const blob = await put(pathname, body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: contentType || undefined,
    multipart: true,
  });

  return {
    url: blob.url,
    contentType: contentType?.split(";")[0] || undefined,
    sizeBytes,
  };
}
