export function buildCreationDownloadPath(creationId: string, url: string) {
  const params = new URLSearchParams({ creationId, url });
  return `/api/creations/download?${params.toString()}`;
}

export function buildCreationDownloadFilename({ type, createdAt, outputIndex, contentType }: {
  type: string;
  createdAt: Date;
  outputIndex: number;
  contentType: string;
}): string {
  const extensions: Record<string, string> = {
    "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
    "image/gif": "gif", "image/avif": "avif", "image/heic": "heic", "image/heif": "heif",
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
    "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/mp3": "mp3",
    "audio/wav": "wav", "audio/x-wav": "wav",
  };
  const extension = extensions[contentType.split(";", 1)[0].trim().toLowerCase()] || "bin";
  const label = type === "video" ? "Video" : type === "music" ? "Audio" : "Image";
  const timestamp = createdAt.toISOString().slice(0, 19).replace("T", "_").replaceAll(":", "");
  const sequence = String(outputIndex + 1).padStart(2, "0");
  return `Flownana-${label}-${timestamp}-${sequence}.${extension}`;
}
