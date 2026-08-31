type InputKind = "image" | "video" | "audio";

/** Relations identify assets, not occurrences: their compound key collapses repeats. */
export function restoreCreationInputs(savedUrls: string[], media: Array<{ mediaAsset: { url: string; type: string } }>) {
  if (!media.length) return { inputUrls: savedUrls };
  const kinds = new Map<string, InputKind>(media.map(({ mediaAsset }) => [mediaAsset.url, mediaAsset.type === "music" ? "audio" : mediaAsset.type as InputKind]));
  const inputUrls = savedUrls.length && savedUrls.every((url) => kinds.has(url))
    ? savedUrls : media.map(({ mediaAsset }) => mediaAsset.url);
  return { inputUrls, inputKinds: inputUrls.map((url) => kinds.get(url)!) };
}
