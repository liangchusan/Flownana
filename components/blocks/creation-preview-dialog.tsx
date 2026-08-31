"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ArrowLeft,
  Download,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { CreationHistoryItem } from "@/lib/creation-history";
import { getCreationParameters } from "@/lib/creation-details";

interface CreationPreviewDialogProps {
  creation: CreationHistoryItem;
  mediaUrl: string;
  onClose: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onDownload: () => void;
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function CreationPreviewDialog({
  creation,
  mediaUrl,
  onClose,
  onRegenerate,
  onDelete,
  onDownload,
}: CreationPreviewDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const parameters = useMemo(() => getCreationParameters(creation), [creation]);
  const parameterItems: Array<[string, string | undefined]> = [
    ["Model", parameters?.model],
    ["Mode", parameters?.mode],
    ["Aspect ratio", parameters?.aspectRatio],
    ["Resolution", parameters?.resolution],
    ["Duration", parameters?.duration ? `${parameters.duration}s` : undefined],
    ["Audio", parameters?.audio],
  ];
  const visibleParameterItems = parameterItems.filter(
    (item): item is [string, string] => typeof item[1] === "string"
  );

  useEffect(() => {
    if (creation.type === "video") {
      videoRef.current?.play().catch(() => undefined);
    }

  }, [creation.type]);

  const title = creation.prompt.trim() || `Untitled ${creation.type}`;
  const createdAt = formatCreatedAt(creation.createdAt);

  return (
    <Modal onClose={onClose}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-stone-950 text-stone-100"
      aria-label={`${creation.type} preview`}
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-3 sm:px-5">
        <button
          type="button"
          onClick={onClose}
          className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-2 text-left transition-all duration-300 hover:bg-white/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
        >
          <ArrowLeft className="h-5 w-5 shrink-0 text-stone-400" />
          <span className="max-w-[60vw] truncate text-sm font-medium text-stone-200 sm:max-w-md">
            {title}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2 text-xs text-stone-500">
          {creation.type === "image" ? (
            <ImageIcon className="h-4 w-4" />
          ) : (
            <Video className="h-4 w-4" />
          )}
          <span className="hidden capitalize sm:inline">{creation.type}</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)] lg:overflow-hidden">
        <section className="flex min-h-[46vh] items-center justify-center bg-surface-dark p-4 sm:p-8 lg:min-h-0 lg:p-10">
          {creation.type === "video" ? (
            <video
              ref={videoRef}
              src={mediaUrl}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full rounded-xl object-contain shadow-sm"
            />
          ) : (
            <img
              src={mediaUrl}
              alt={creation.prompt || "Generated image"}
              className="max-h-full max-w-full rounded-xl object-contain shadow-sm"
            />
          )}
        </section>

        <aside className="flex min-h-[46vh] flex-col border-t border-white/10 bg-stone-950 lg:min-h-0 lg:border-l lg:border-t-0">
          <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-7 sm:py-8">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-stone-200">
                {creation.type === "image" ? (
                  <ImageIcon className="h-4 w-4 text-stone-500" />
                ) : (
                  <Video className="h-4 w-4 text-stone-500" />
                )}
                <span className="capitalize">{creation.type}</span>
              </div>
              {createdAt && <p className="mt-2 text-xs text-stone-600">{createdAt}</p>}
            </div>

            <div className="border-t border-white/10 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Prompt
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-stone-200">
                {creation.prompt || "No prompt saved for this creation."}
              </p>
            </div>

            <div className="border-t border-white/10 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Generation details
              </p>
              {visibleParameterItems.length > 0 ? (
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  {visibleParameterItems.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                    >
                      <dt className="text-[10px] uppercase tracking-wide text-stone-600">
                        {label}
                      </dt>
                      <dd className="mt-1 break-words text-xs font-medium text-stone-300">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-stone-600">
                  Detailed settings were not saved for this older creation.
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-white/10 p-4 sm:p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
              Actions
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <Button
                type="button"
                onClick={onRegenerate}
                className="justify-start border border-white/10 bg-white/[0.06] text-stone-200 transition-all duration-300 hover:bg-white/10 active:scale-[0.98]"
              >
                <RefreshCw className="mr-2 h-4 w-4 text-stone-400" />
                Regenerate
              </Button>
              <Button
                type="button"
                onClick={onDownload}
                className="justify-start border border-white/10 bg-white/[0.06] text-stone-200 transition-all duration-300 hover:bg-white/10 active:scale-[0.98]"
              >
                <Download className="mr-2 h-4 w-4 text-stone-400" />
                Download
              </Button>
              <Button
                type="button"
                onClick={onDelete}
                className="justify-start border border-red-900/60 bg-red-950/30 text-red-300 transition-all duration-300 hover:bg-red-950/60 active:scale-[0.98]"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
