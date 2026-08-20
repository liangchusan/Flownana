const VERCEL_BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export function isVercelBlobUrl(url: string) {
  try {
    return new URL(url).hostname.endsWith(VERCEL_BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

export function addMediaRetryParam(url: string, retryToken: string | number) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("flownana_retry", String(retryToken));
    return parsed.toString();
  } catch {
    return url;
  }
}
