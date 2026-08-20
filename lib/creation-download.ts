export function buildCreationDownloadPath(creationId: string, url: string) {
  const params = new URLSearchParams({ creationId, url });
  return `/api/creations/download?${params.toString()}`;
}

export function buildVercelBlobDownloadUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".public.blob.vercel-storage.com")) {
      return null;
    }
    parsed.searchParams.set("download", "1");
    return parsed.toString();
  } catch {
    return null;
  }
}
