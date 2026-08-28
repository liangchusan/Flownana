export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ACTIVE_GENERATION_STATUSES = [
  "pending",
  "generating",
  "processing",
] as const;

export function getAvatarValidationError(file: {
  size: number;
  type: string;
}): string | null {
  if (!(ALLOWED_AVATAR_TYPES as readonly string[]).includes(file.type)) {
    return "Choose a JPG, PNG, or WebP image.";
  }
  if (file.size <= 0) {
    return "The selected image is empty.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return "Profile photos must be 5 MB or smaller.";
  }
  return null;
}

export function isOwnedBlobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

export function isDeleteConfirmationValid(value: unknown): boolean {
  return value === "DELETE";
}

export function isMissingProfileSchemaError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2022"
  );
}
