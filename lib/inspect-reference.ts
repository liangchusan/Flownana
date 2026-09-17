import { readMediaDuration } from "./media-duration.ts";
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
  return { kind, sizeBytes: bytes.length, contentType: media.contentType, ...(durationSeconds ? { durationSeconds } : {}) };
}
export async function validateReferenceDurations(caps: GenerationInputCapabilities, refs: Array<{ url: string; kind: ComposerAttachmentKind }>) {
  const metadata: ReferenceMetadata[] = [];
  // Sequential reads cap memory even for a batch of large files.
  for (const ref of refs) {
    if (ref.kind === "image") { metadata.push(ref); continue; }
    metadata.push(await inspectReference(ref.url, ref.kind, referenceMaxBytes(caps, ref.kind)));
  }
  const issue = referenceBatchIssue(caps, metadata);
  if (issue) throw new Error(issue);
}
