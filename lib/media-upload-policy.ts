export const MEDIA_UPLOAD_RULES = {
  image: { max: 20 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"] },
  video: { max: 50 * 1024 * 1024, types: ["video/mp4", "video/quicktime"] },
  audio: { max: 15 * 1024 * 1024, types: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"] },
} as const;

export type MediaUploadKind = keyof typeof MEDIA_UPLOAD_RULES;
export const MEDIA_UPLOAD_TOKEN_TTL_MS = 10 * 60 * 1000;
export const MEDIA_UPLOAD_GRANTS_PER_HOUR = 60;
export const MEDIA_UPLOAD_BYTES_PER_DAY = 1024 * 1024 * 1024;
export const MEDIA_UPLOAD_TOTAL_BYTES = 5 * 1024 * 1024 * 1024;
export const MEDIA_UPLOAD_CALLBACK_GRACE_MS = 24 * 60 * 60 * 1000;

export type MediaUploadPayload = { kind: MediaUploadKind; sizeBytes: number; uploadId: string };

export function parseMediaUploadPayload(value: string | null): MediaUploadPayload {
  let parsed: unknown;
  try {
    parsed = value ? JSON.parse(value) : null;
  } catch {
    throw new Error("Invalid upload payload.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid upload payload.");
  const candidate = parsed as Record<string, unknown>;
  const { kind, sizeBytes, uploadId } = candidate;
  if (
    typeof kind !== "string" || !(kind in MEDIA_UPLOAD_RULES) ||
    typeof sizeBytes !== "number" || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 ||
    typeof uploadId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId)
  ) throw new Error("Invalid upload payload.");
  const rule = MEDIA_UPLOAD_RULES[kind as MediaUploadKind];
  if (sizeBytes > rule.max) throw new Error("Upload exceeds the maximum file size.");
  return { kind: kind as MediaUploadKind, sizeBytes, uploadId };
}

export function getUploadIdFromBlobUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".public.blob.vercel-storage.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "generation-inputs" || parts.length < 4) return null;
    return /^[0-9a-f-]{36}$/i.test(parts[2]) ? parts[2] : null;
  } catch {
    return null;
  }
}

export function shouldDeleteOrphanedUpload(params: {
  uploadedAt: Date;
  now: Date;
  grant: { completedAt: Date | null; expiresAt: Date } | null;
}) {
  if (
    params.now.getTime() - params.uploadedAt.getTime() <
    MEDIA_UPLOAD_CALLBACK_GRACE_MS
  ) return false;
  if (!params.grant) return true;
  return !params.grant.completedAt && params.grant.expiresAt < params.now;
}
