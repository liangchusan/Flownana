"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AtSign,
  Download,
  Ellipsis,
  Image as ImageIcon,
  Music,
  RefreshCw,
  Settings2,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResilientMedia } from "@/components/ui/resilient-media";
import { useToast } from "@/components/blocks/app-toast-provider";
import { creationIdentity, formatConversationTimestamp, formatProcessingDuration, getCreationRunRemovalTarget, shouldShowConversationTimestamp, type CreationHistoryItem } from "@/lib/creation-history";
import { getCreationParameters } from "@/lib/creation-details";
import { trackEvent } from "@/lib/analytics";

const ACTIVE_STATUSES = new Set(["pending", "generating", "processing"]);

export interface WorkspaceRun {
  id: string;
  type: CreationHistoryItem["type"];
  prompt: string;
  createdAt: string;
  creations: CreationHistoryItem[];
}

export function groupWorkspaceRuns(creations: CreationHistoryItem[]): WorkspaceRun[] {
  const grouped = new Map<string, CreationHistoryItem[]>();
  for (const creation of creations) {
    if (creation.parameters?.hiddenFromRecent) continue;
    const key = creation.parameters?.runId || creationIdentity(creation);
    const current = grouped.get(key) || [];
    current.push(creation);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([id, items]) => {
      const ordered = [...items].sort(
        (a, b) =>
          (a.parameters?.outputIndex ?? 0) - (b.parameters?.outputIndex ?? 0)
      );
      const first = ordered[0];
      return {
        id,
        type: first.type,
        prompt: first.prompt,
        createdAt: first.createdAt,
        creations: ordered,
      };
    })
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

function MediaViewer({
  creation,
  url,
  onClose,
}: {
  creation: CreationHistoryItem;
  url: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-surface-dark/95 p-4" role="dialog" aria-modal="true" aria-label="Media preview">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-all duration-300 hover:bg-white/20" aria-label="Close preview"><X className="h-5 w-5" /></button>
      {creation.type === "image" ? (
        <ResilientMedia creationId={creation.taskId || creation.id} url={url} label="Image" className="max-w-xl rounded-ui-xl">
          {({ src, onError, onReady }) => <img src={src} alt={creation.prompt} onError={onError} onLoad={onReady} className="max-h-[88vh] max-w-[92vw] rounded-ui-xl object-contain" />}
        </ResilientMedia>
      ) : creation.type === "video" ? (
        <ResilientMedia creationId={creation.taskId || creation.id} url={url} label="Video" className="max-w-xl rounded-ui-xl">
          {({ src, onError, onReady }) => <video src={src} controls autoPlay playsInline onError={onError} onLoadedData={onReady} className="max-h-[88vh] max-w-[92vw] rounded-ui-xl object-contain" />}
        </ResilientMedia>
      ) : (
        <div className="w-full max-w-xl rounded-ui-xl border border-white/10 bg-surface-elevated p-8 text-center text-white">
          <Music className="mx-auto h-12 w-12 text-stone-400" />
          <p className="mt-4 text-sm text-stone-300">{creation.prompt}</p>
          <div className="relative mt-6 overflow-hidden rounded-ui-lg">
            <ResilientMedia creationId={creation.taskId || creation.id} url={url} label="Audio" className="min-h-32 rounded-ui-lg">
              {({ src, onError, onReady }) => <audio src={src} controls autoPlay onError={onError} onCanPlay={onReady} className="w-full" />}
            </ResilientMedia>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoResult({ creationId, url, prompt, onOpen }: { creationId: string; url: string; prompt: string; onOpen: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <ResilientMedia creationId={creationId} url={url} label="Video" className="max-w-lg rounded-ui-lg">
      {({ src, onError, onReady }) => (
        <button type="button" onClick={onOpen} onMouseEnter={() => ref.current?.play().catch(() => undefined)} onMouseLeave={() => { if (!ref.current) return; ref.current.pause(); ref.current.currentTime = 0; }} className="relative inline-flex max-w-full overflow-hidden rounded-ui-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <video ref={ref} src={src} muted playsInline preload="metadata" onError={onError} onLoadedData={onReady} aria-label={prompt} className="h-auto max-h-[30rem] w-auto max-w-full object-contain" />
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 p-2 text-white"><Video className="h-4 w-4" /></span>
        </button>
      )}
    </ResilientMedia>
  );
}

function ResultActions({
  creation,
  url,
  onReference,
  onDelete,
}: {
  creation: CreationHistoryItem;
  url: string;
  onReference: () => void;
  onDelete: () => void;
}) {
  const download = () => {
    trackEvent("result_download_clicked", { type: creation.type, source: "create_stream" });
    window.location.href = `/api/creations/download?id=${encodeURIComponent(creation.taskId || creation.id)}&url=${encodeURIComponent(url)}`;
  };
  return (
    <div className="absolute right-2 top-2 z-20 flex items-center gap-1 opacity-100 transition-all duration-300 sm:translate-y-1 sm:opacity-0 sm:group-hover/result:translate-y-0 sm:group-hover/result:opacity-100 sm:group-focus-within/result:translate-y-0 sm:group-focus-within/result:opacity-100">
      {[
        { label: "Download", icon: Download, action: download },
        { label: "Reference", icon: AtSign, action: onReference },
        { label: "Delete", icon: Trash2, action: onDelete },
      ].map((item) => {
        const Icon = item.icon;
        return <button key={item.label} type="button" onClick={(event) => { event.stopPropagation(); item.action(); }} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-stone-950/80 text-white shadow-soft transition-all duration-300 hover:bg-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={item.label} title={item.label}><Icon className="h-4 w-4" /></button>;
      })}
    </div>
  );
}

function RunStatus({ run }: { run: WorkspaceRun }) {
  const isProcessing = run.creations.some((creation) => ACTIVE_STATUSES.has(creation.status));
  const hasFailed = run.creations.some((creation) => creation.status === "failed");
  const [now, setNow] = useState(() => new Date(run.createdAt).getTime());

  useEffect(() => {
    if (!isProcessing) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [isProcessing]);

  const savedDurations = run.creations
    .map((creation) => creation.parameters?.processingDurationMs)
    .filter((duration): duration is number => typeof duration === "number");
  const savedDuration = savedDurations.length > 0 ? Math.max(...savedDurations) : undefined;
  const startedAt = new Date(run.createdAt).getTime();
  const liveDuration = Number.isFinite(startedAt) ? Math.max(0, now - startedAt) : undefined;
  const duration = isProcessing ? liveDuration : savedDuration;
  const label = isProcessing ? "Processing" : hasFailed ? "Failed" : "Processed";
  const connector = isProcessing ? "" : hasFailed ? " after" : " in";
  const statusClassName = isProcessing
    ? "text-sm font-medium text-muted-foreground"
    : hasFailed
      ? "text-xs font-normal text-destructive/70"
      : "text-xs font-normal text-stone-400";

  return (
    <div className="border-b border-border pb-3">
      <p className={statusClassName}>
        {label}{duration !== undefined ? `${connector} ${formatProcessingDuration(duration)}` : ""}
      </p>
    </div>
  );
}

function PendingResult({ creation }: { creation: CreationHistoryItem }) {
  if (creation.type === "music") {
    return (
      <div className="relative flex min-h-32 w-full max-w-lg items-center justify-center overflow-hidden rounded-ui-lg bg-surface-soft">
        <Image src="/logo.png" alt="" fill sizes="512px" className="creation-loading-logo object-cover opacity-45" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/20 via-transparent to-background/30" />
        <span className="sr-only">Creating audio</span>
      </div>
    );
  }

  const aspectRatio = creation.parameters?.aspectRatio;
  const layoutClassName = aspectRatio === "9:16"
    ? "aspect-[9/16] h-[min(30rem,70vh)] max-w-full"
    : aspectRatio === "3:4"
      ? "aspect-[3/4] h-[min(30rem,70vh)] max-w-full"
      : aspectRatio === "16:9" || (creation.type === "video" && (!aspectRatio || aspectRatio === "Auto" || aspectRatio === "auto"))
        ? "aspect-video w-full max-w-lg"
        : aspectRatio === "4:3"
          ? "aspect-[4/3] w-full max-w-lg"
          : "aspect-square w-full max-w-lg";

  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-ui-lg bg-surface-soft ${layoutClassName}`}>
      <Image src="/logo.png" alt="" fill sizes="(max-width: 640px) 100vw, 512px" className="creation-loading-logo object-cover opacity-45" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/20 via-transparent to-background/30" />
      <span className="sr-only">Creating {creation.type}</span>
    </div>
  );
}

function getRunMetadata(run: WorkspaceRun) {
  const parameters = getCreationParameters(run.creations[0]);
  if (!parameters) return [];
  const values: string[] = [];
  if (parameters.model) values.push(parameters.model);
  if (run.type === "image") {
    if (parameters.aspectRatio) values.push(parameters.aspectRatio);
    if (parameters.resolution) values.push(parameters.resolution);
    const outputCount = Math.max(...run.creations.map((creation) => creation.parameters?.outputCount || 1));
    if (outputCount > 1) values.push(`${outputCount} outputs`);
  } else if (run.type === "video") {
    if (parameters.aspectRatio) values.push(parameters.aspectRatio);
    if (parameters.resolution) values.push(parameters.resolution);
    if (parameters.duration !== undefined) values.push(`${parameters.duration}s`);
    if (parameters.audio) values.push(`Sound ${parameters.audio}`);
  } else if (parameters.mode) {
    values.push(parameters.mode);
  }
  return values;
}

export function CreationStream({
  creations,
  onReprompt,
  onReference,
  onDetails,
  onChange,
}: {
  creations: CreationHistoryItem[];
  onReprompt: (creation: CreationHistoryItem) => void;
  onReference: (creation: CreationHistoryItem, url: string) => void;
  onDetails: (run: WorkspaceRun) => void;
  onChange: (identity: string, patch: Partial<CreationHistoryItem>) => void;
}) {
  const { showToast } = useToast();
  const runs = useMemo(() => groupWorkspaceRuns(creations), [creations]);
  const [viewer, setViewer] = useState<{ creation: CreationHistoryItem; url: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ creation: CreationHistoryItem; url: string } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<WorkspaceRun | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const removeActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (removeActionRef.current?.contains(event.target as Node)) return;
      setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu]);

  const deleteMedia = async () => {
    if (!pendingDelete) return;
    const { creation, url } = pendingDelete;
    const response = await fetch("/api/creations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: creation.taskId || creation.id, action: "delete-media", url }),
    });
    if (!response.ok) {
      showToast({ title: "Could not delete media", message: "Please try again.", variant: "error" });
      return;
    }
    const nextUrls = creation.urls.filter((item) => item !== url);
    onChange(creationIdentity(creation), { urls: nextUrls, status: nextUrls.length ? "success" : "deleted" });
    setPendingDelete(null);
  };

  const removeRun = async () => {
    if (!pendingRemove) return;
    const target = getCreationRunRemovalTarget(pendingRemove.creations[0]);
    const response = await fetch("/api/creations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...target, action: "hide-from-recent" }),
    });
    if (!response.ok) {
      showToast({ title: "Could not remove record", message: "Please try again.", variant: "error" });
      return;
    }
    pendingRemove.creations.forEach((creation) => onChange(creationIdentity(creation), { parameters: { ...creation.parameters, hiddenFromRecent: true } }));
    setPendingRemove(null);
  };

  if (runs.length === 0) {
    return (
      <div className="flex min-h-[45vh] flex-col items-center justify-center px-6 pb-72 text-center sm:pb-64">
        <div className="flex h-14 w-14 items-center justify-center rounded-ui-xl bg-surface-soft text-muted-foreground"><ImageIcon className="h-6 w-6" /></div>
        <h2 className="mt-5 font-display text-2xl font-medium text-foreground">Create your first piece</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Describe an image, video, or sound below. Every request stays paired with its result.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-12 px-4 pb-96 pt-8 sm:px-6 sm:pb-80 lg:px-8 lg:pb-72">
      {runs.map((run, runIndex) => {
        const requestedCount = Math.max(...run.creations.map((item) => item.parameters?.outputCount || 1));
        const cells = [...run.creations];
        const metadata = getRunMetadata(run);
        const firstCreation = run.creations[0];
        while (cells.length < requestedCount) {
          cells.push({ ...run.creations[0], id: `${run.id}-placeholder-${cells.length}`, urls: [], status: "generating", parameters: { ...run.creations[0].parameters, outputIndex: cells.length } });
        }
        const showTimestamp = shouldShowConversationTimestamp(
          run.createdAt,
          runs[runIndex - 1]?.createdAt
        );
        return (
          <div key={run.id} className="space-y-8">
          {showTimestamp && (
            <p className="text-center text-xs font-normal text-stone-400">
              {formatConversationTimestamp(run.createdAt)}
            </p>
          )}
          <article className="space-y-6">
            <div className="flex justify-end">
              <div className="flex max-w-[88%] flex-col items-end gap-2 sm:max-w-2xl">
                {firstCreation.inputUrls.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {firstCreation.inputUrls.map((url, index) => (
                      <div key={url} className="relative inline-flex max-h-36 max-w-48 overflow-hidden rounded-ui-lg bg-surface-soft">
                        <ResilientMedia creationId={firstCreation.taskId || firstCreation.id} url={url} label={`Input ${index + 1}`} className="min-h-0 w-48 rounded-ui-lg py-4">
                          {({ src, onError, onReady }) => <img src={src} alt={`Original input ${index + 1}`} onError={onError} onLoad={onReady} className="h-auto max-h-36 w-auto max-w-48 object-contain" />}
                        </ResilientMedia>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-ui-xl rounded-br-sm bg-surface-strong px-4 py-3 text-sm leading-relaxed text-foreground">{run.prompt}</div>
              </div>
            </div>

            <section className="space-y-4">
              <RunStatus run={run} />
              {metadata.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {metadata.map((value, index) => <span key={`${value}-${index}`} className="after:ml-2 after:text-border after:content-['·'] last:after:content-none">{value}</span>)}
                </div>
              )}

              <div className={cells.length === 1 ? "w-full max-w-lg" : "grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2"}>
                {cells.map((creation, index) => {
                  const url = creation.urls[0];
                  const key = `${creationIdentity(creation)}-${index}`;
                  if (creation.status === "deleted") {
                    return <div key={key} className="flex min-h-16 items-center rounded-ui-lg bg-surface-soft px-4 text-xs text-muted-foreground"><Trash2 className="mr-2 h-4 w-4" />Media deleted</div>;
                  }
                  if (ACTIVE_STATUSES.has(creation.status)) {
                    return <PendingResult key={key} creation={creation} />;
                  }
                  if (creation.status === "failed") {
                    return <div key={key} className="max-w-lg rounded-ui-lg bg-destructive/5 px-4 py-3"><p className="text-sm font-medium text-destructive">Generation failed</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{creation.error || "Please reprompt and try again."}</p></div>;
                  }
                  if (!url) return null;
                  return (
                    <div key={key} className={`group/result relative min-w-0 ${creation.type === "music" ? "w-full max-w-lg" : "w-fit max-w-full"}`}>
                      {creation.type === "image" ? <ResilientMedia creationId={creation.taskId || creation.id} url={url} label="Image" className="max-w-lg rounded-ui-lg">{({ src, onError, onReady }) => <button type="button" onClick={() => setViewer({ creation, url })} className="inline-flex max-w-full overflow-hidden rounded-ui-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><img src={src} alt={creation.prompt} onError={onError} onLoad={onReady} className="h-auto max-h-[30rem] w-auto max-w-full object-contain" /></button>}</ResilientMedia> : creation.type === "video" ? <VideoResult creationId={creation.taskId || creation.id} url={url} prompt={creation.prompt} onOpen={() => setViewer({ creation, url })} /> : <div className="relative w-full max-w-lg"><ResilientMedia creationId={creation.taskId || creation.id} url={url} label="Audio" className="min-h-0 rounded-ui-lg py-4">{({ src, onError, onReady }) => <audio src={src} controls onError={onError} onCanPlay={onReady} className="w-full" />}</ResilientMedia></div>}
                      <ResultActions creation={creation} url={url} onReference={() => onReference(creation, url)} onDelete={() => setPendingDelete({ creation, url })} />
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <button type="button" onClick={() => onReprompt(run.creations[0])} className="flex h-9 items-center gap-1.5 rounded-ui px-2.5 text-xs font-medium text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground"><RefreshCw className="h-4 w-4" />Reprompt</button>
                <button type="button" onClick={() => onDetails(run)} className="flex h-9 items-center gap-1.5 rounded-ui px-2.5 text-xs font-medium text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground"><Settings2 className="h-4 w-4" />Details</button>
                <div className="relative">
                  <button type="button" onClick={() => setOpenMenu(openMenu === run.id ? null : run.id)} className="flex h-9 w-9 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground" aria-label="More actions" aria-haspopup="menu" aria-expanded={openMenu === run.id}><Ellipsis className="h-4 w-4" /></button>
                  {openMenu === run.id && <div role="menu" className="absolute bottom-11 right-0 z-20 w-48 rounded-ui-lg border border-border bg-background p-1 shadow-float"><button ref={removeActionRef} role="menuitem" type="button" onClick={() => { setOpenMenu(null); setPendingRemove(run); }} className="flex w-full items-center gap-2 rounded-ui px-3 py-2 text-left text-xs text-destructive transition-all duration-300 hover:bg-destructive/5"><Trash2 className="h-4 w-4" />Remove from recent</button></div>}
                </div>
              </div>
            </section>
          </article>
          </div>
        );
      })}

      {viewer && <MediaViewer creation={viewer.creation} url={viewer.url} onClose={() => setViewer(null)} />}
      {(pendingDelete || pendingRemove) && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/25 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-ui-xl border border-border bg-background p-6 shadow-float">
            <h2 className="text-lg font-medium text-foreground">{pendingDelete ? "Delete this media?" : "Remove this record from recent?"}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pendingDelete ? "The media will disappear from Create and Assets. A compact deleted placeholder will remain in this record." : "The Prompt and Result record will leave Create. Successful media remains available in Assets."}</p>
            <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setPendingDelete(null); setPendingRemove(null); }}>Cancel</Button><Button type="button" onClick={pendingDelete ? deleteMedia : removeRun} className="bg-destructive text-white hover:bg-destructive/90">Confirm</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
