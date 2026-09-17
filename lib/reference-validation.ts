import type { GenerationInputCapabilities, ComposerAttachmentKind } from "./generation-input-capabilities.ts";
import { MEDIA_UPLOAD_RULES } from "./media-upload-policy.ts";

export type ReferenceMetadata = { kind: ComposerAttachmentKind; contentType?: string; sizeBytes?: number; durationSeconds?: number; name?: string };
export function referenceLimit(caps: GenerationInputCapabilities, kind: ComposerAttachmentKind) {
  return kind === "image" ? caps.maxImages : kind === "video" ? caps.maxVideos : caps.maxAudios;
}
export function referenceMaxBytes(caps: GenerationInputCapabilities, kind: ComposerAttachmentKind, upload = false) {
  const model = kind === "image" ? caps.maxImageBytes : kind === "video" ? caps.maxVideoBytes : caps.maxAudioBytes;
  return upload ? Math.min(model, MEDIA_UPLOAD_RULES[kind].max) : model;
}
export function referenceIssue(caps: GenerationInputCapabilities, ref: ReferenceMetadata, options: { upload?: boolean; requireMetadata?: boolean } = {}) {
  if (!referenceLimit(caps, ref.kind)) return `This model does not support ${ref.kind} references.`;
  const allowed = ref.kind === "image" ? caps.imageContentTypes ?? MEDIA_UPLOAD_RULES.image.types : MEDIA_UPLOAD_RULES[ref.kind].types;
  if (ref.contentType && !allowed.includes(ref.contentType.toLowerCase() as never)) return `Unsupported ${ref.kind} format. Choose ${allowed.map(t => t.split("/")[1]).join(", ")}.`;
  if (options.upload && ref.contentType && !MEDIA_UPLOAD_RULES[ref.kind].types.includes(ref.contentType as never)) return "This file format is not supported for upload.";
  const max = referenceMaxBytes(caps, ref.kind, options.upload);
  if (ref.sizeBytes != null && (!Number.isFinite(ref.sizeBytes) || ref.sizeBytes <= 0 || ref.sizeBytes > max)) return `File is ${(ref.sizeBytes / 1024 ** 2).toFixed(1)} MB. Maximum: ${max / 1024 ** 2} MB per ${ref.kind}.`;
  if (options.requireMetadata && (!ref.contentType || ref.sizeBytes == null)) return "Check this file before adding it.";
  if (ref.kind !== "image") {
    if (options.requireMetadata && ref.durationSeconds == null) return "Could not read the duration. Retry or choose another file.";
    const d = ref.durationSeconds;
    if (d != null && (!Number.isFinite(d) || d <= 0)) return "Could not read the duration. Choose another file.";
    // Agent accepts references before selecting a generation model.
    if (caps.referenceDurationLimits !== false && d != null && (d < 2 || d > 15)) return `File is ${d.toFixed(2)}s. Reference ${ref.kind} must be 2–15 seconds.`;
  }
  return undefined;
}
export function referenceBatchIssue(caps: GenerationInputCapabilities, refs: ReferenceMetadata[], requireMetadata = false) {
  if (caps.maxReferences && refs.length > caps.maxReferences) return `Keep at most ${caps.maxReferences} references.`;
  for (const kind of ["image", "video", "audio"] as const) {
    const items = refs.filter(r => r.kind === kind);
    if (items.length > referenceLimit(caps, kind)) return `This model accepts at most ${referenceLimit(caps, kind)} ${kind} references; ${items.length} selected.`;
    for (const ref of items) { const issue = referenceIssue(caps, ref, { requireMetadata }); if (issue) return `${ref.name ? `${ref.name}: ` : ""}${issue}`; }
    const totalSeconds = items.reduce((n, r) => n + (r.durationSeconds ?? 0), 0);
    if (kind !== "image" && caps.referenceDurationLimits !== false && totalSeconds > 15) return `Combined ${kind} references are ${totalSeconds.toFixed(2)}s. Maximum: 15 seconds. Remove or replace a file.`;
  }
  return undefined;
}
export const AGENT_INPUT_CAPABILITIES: GenerationInputCapabilities = {
  maxImages: 22, maxVideos: 22, maxAudios: 22, maxReferences: 22, referenceDurationLimits: false,
  maxImageBytes: MEDIA_UPLOAD_RULES.image.max, maxVideoBytes: MEDIA_UPLOAD_RULES.video.max, maxAudioBytes: MEDIA_UPLOAD_RULES.audio.max,
  imageRequired: false, imageRoles: [], acceptsVideo: true, acceptsAudio: true,
};
