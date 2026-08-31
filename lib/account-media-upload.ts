"use client";

import { upload } from "@vercel/blob/client";
import type { createAccountOperationOwner } from "./account-operation";

export async function uploadAccountMedia(file: File, kind: "image" | "video" | "audio", operation: ReturnType<ReturnType<typeof createAccountOperationOwner>["capture"]>) {
  operation.assertCurrent();
  const uploadId = crypto.randomUUID();
  const blob = await upload(`generation-inputs/${kind}/${uploadId}/${file.name}`, file, {
    access: "public",
    handleUploadUrl: "/api/creations/upload",
    headers: operation.headers,
    abortSignal: operation.signal,
    clientPayload: JSON.stringify({ kind, sizeBytes: file.size, uploadId }),
    multipart: file.size > 4 * 1024 * 1024,
  });
  operation.assertCurrent();
  return blob;
}
