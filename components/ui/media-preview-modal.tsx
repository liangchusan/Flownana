"use client";

import { Music, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { ResilientMedia } from "@/components/ui/resilient-media";

type PreviewMediaType = "image" | "video" | "audio";

export function MediaPreviewModal({
  creationId,
  url,
  type,
  alt,
  prompt,
  onClose,
}: {
  creationId?: string;
  url: string;
  type: PreviewMediaType;
  alt: string;
  prompt?: string;
  onClose: () => void;
}) {
  const renderMedia = ({
    src,
    onError,
    onReady,
  }: {
    src: string;
    onError: () => void;
    onReady: () => void;
  }) => (
    type === "image" ? (
      <img src={src} alt={alt} onError={onError} onLoad={onReady} className="max-h-[calc(100dvh-2rem)] max-w-full rounded-ui-xl object-contain sm:max-h-[calc(100dvh-3rem)]" />
    ) : type === "video" ? (
      <video src={src} controls autoPlay playsInline onError={onError} onLoadedData={onReady} className="max-h-[calc(100dvh-2rem)] max-w-full rounded-ui-xl object-contain sm:max-h-[calc(100dvh-3rem)]" />
    ) : (
      <div className="w-full max-w-xl rounded-ui-xl border border-white/10 bg-surface-elevated p-6 text-center text-white sm:p-8">
        <Music className="mx-auto h-12 w-12 text-muted-foreground" />
        {prompt && <p className="mt-4 text-sm text-stone-300">{prompt}</p>}
        <audio src={src} controls autoPlay onError={onError} onCanPlay={onReady} className="mt-6 w-full" />
      </div>
    )
  );

  return (
    <Modal
      onClose={onClose}
      aria-label={`${type} preview`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-surface-dark/95 p-4 backdrop:bg-surface-dark/95 sm:p-6"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-all duration-300 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] sm:right-5 sm:top-5"
        aria-label="Close preview"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex max-h-[calc(100dvh-2rem)] max-w-[min(92vw,80rem)] items-center justify-center sm:max-h-[calc(100dvh-3rem)]">
        {creationId ? (
          <ResilientMedia creationId={creationId} url={url} label={type === "audio" ? "Audio" : type === "video" ? "Video" : "Image"} className="rounded-ui-xl">
            {renderMedia}
          </ResilientMedia>
        ) : renderMedia({ src: url, onError: () => undefined, onReady: () => undefined })}
      </div>
    </Modal>
  );
}
