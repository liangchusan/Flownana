export function buildCreationDownloadPath(creationId: string, url: string) {
  const params = new URLSearchParams({ creationId, url });
  return `/api/creations/download?${params.toString()}`;
}
