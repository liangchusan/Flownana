"use client";

import { ResilientMedia } from "@/components/ui/resilient-media";

export function InputMedia({ creationId, url, kind = "image", index }: {
  creationId: string; url: string; kind?: "image" | "video" | "audio"; index: number;
}) {
  const label = `Original input ${kind} ${index + 1}`;
  return <ResilientMedia creationId={creationId} url={url} label={label} className="min-h-0 w-48 rounded-ui-lg py-4">
    {({ src, onError, onReady }) => kind === "video"
      ? <video src={src} aria-label={label} controls playsInline preload="metadata" onError={onError} onLoadedData={onReady} className="h-auto max-h-36 max-w-48 object-contain" />
      : kind === "audio"
        ? <audio src={src} aria-label={label} controls preload="metadata" onError={onError} onCanPlay={onReady} className="w-48 max-w-full" />
        : <img src={src} alt={label} onError={onError} onLoad={onReady} className="h-auto max-h-36 w-auto max-w-48 object-contain" />}
  </ResilientMedia>;
}
