import { readMediaDuration } from "./media-duration.ts";
import { movieVideoMetadata } from "./video-metadata.ts";
import sharp from "sharp";
import { safeRemoteMediaFetch } from "@/lib/safe-remote-media";
import type { ReferenceMetadata } from "@/lib/reference-validation";
import { referenceBatchIssue, referenceMaxBytes } from "@/lib/reference-validation";
import type { GenerationInputCapabilities, ComposerAttachmentKind } from "@/lib/generation-input-capabilities";

// Called only after ownership validation. Bounded downloads validate the actual bytes,
// rather than trusting client duration or migration-era metadata.
export async function inspectReference(url: string, kind: ComposerAttachmentKind, maxBytes: number): Promise<ReferenceMetadata> {
  const media = await safeRemoteMediaFetch({ url, kind: kind === "audio" ? "music" : kind, maxBytes, timeoutMs: 30_000 });
  const bytes = new Uint8Array(await new Response(media.body).arrayBuffer());
  if (!bytes.length) throw new Error("This file is empty.");
  let durationSeconds: number | undefined;
  if (kind !== "image") {
    durationSeconds = await readMediaDuration(bytes, kind, media.contentType);
    if (!durationSeconds || !Number.isFinite(durationSeconds)) throw new Error("Could not read the file duration. Choose another file.");
  }
  const geometry: { width?: number; height?: number; frameRate?: number; codec?: string; hasTransparency?: boolean } = kind === "image" ? await sharp(bytes).metadata().then(async info => ({
    width: info.width, height: info.height, hasTransparency: info.hasAlpha ? !(await sharp(bytes).stats()).isOpaque : false,
  }))
    : kind === "video" ? movieVideoMetadata(bytes) : {};
  if (kind !== "audio" && (!geometry.width || !geometry.height)) throw new Error("Could not read the reference dimensions. Export the file and retry.");
  return { kind, sizeBytes: bytes.length, contentType: media.contentType, ...geometry, ...(durationSeconds ? { durationSeconds } : {}) };
}
export async function validateReferenceDurations(caps: GenerationInputCapabilities, refs: Array<{ url: string; kind: ComposerAttachmentKind }>) {
  const metadata: ReferenceMetadata[] = [];
  // Sequential reads cap memory even for a batch of large files.
  for (const ref of refs) {
    if (ref.kind === "image" && !caps.imageGeometry) { metadata.push(ref); continue; }
    metadata.push(await inspectReference(ref.url, ref.kind, referenceMaxBytes(caps, ref.kind)));
  }
  const issue = referenceBatchIssue(caps, metadata);
  if (issue) throw new Error(issue);
  return metadata;
}
