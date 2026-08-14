"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign,
  Download,
  Ellipsis,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Music,
  RefreshCw,
  Settings2,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/blocks/app-toast-provider";
import { creationIdentity, type CreationHistoryItem } from "@/lib/creation-history";
import { trackEvent } from "@/lib/analytics";

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
        <img src={url} alt={creation.prompt} className="max-h-[88vh] max-w-[92vw] rounded-ui-xl object-contain" />
      ) : creation.type === "video" ? (
        <video src={url} controls autoPlay playsInline className="max-h-[88vh] max-w-[92vw] rounded-ui-xl object-contain" />
      ) : (
        <div className="w-full max-w-xl rounded-ui-xl border border-white/10 bg-surface-elevated p-8 text-center text-white">
          <Music className="mx-auto h-12 w-12 text-stone-400" />
          <p className="mt-4 text-sm text-stone-300">{creation.prompt}</p>
          <audio src={url} controls autoPlay className="mt-6 w-full" />
        </div>
      )}
    </div>
  );
}

function VideoResult({ url, prompt, onOpen }: { url: string; prompt: string; onOpen: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <button type="button" onClick={onOpen} onMouseEnter={() => ref.current?.play().catch(() => undefined)} onMouseLeave={() => { if (!ref.current) return; ref.current.pause(); ref.current.currentTime = 0; }} className="relative flex h-full min-h-48 w-full items-center justify-center overflow-hidden rounded-ui-lg bg-surface-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <video ref={ref} src={url} muted playsInline preload="metadata" aria-label={prompt} className="max-h-[34rem] h-full w-full object-contain" />
      <span className="absolute bottom-2 right-2 rounded-full bg-black/60 p-2 text-white"><Video className="h-4 w-4" /></span>
    </button>
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
    <div className="absolute inset-x-2 bottom-2 flex translate-y-1 items-center justify-end gap-1 opacity-0 transition-all duration-300 group-hover/result:translate-y-0 group-hover/result:opacity-100 group-focus-within/result:translate-y-0 group-focus-within/result:opacity-100">
      {[
        { label: "Download", icon: Download, action: download },
        { label: "Reference", icon: AtSign, action: onReference },
        { label: "Delete", icon: Trash2, action: onDelete },
      ].map((item) => {
        const Icon = item.icon;
        return <button key={item.label} type="button" onClick={(event) => { event.stopPropagation(); item.action(); }} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-stone-950/80 text-white shadow-soft transition-all duration-300 hover:bg-stone-900" aria-label={item.label}><Icon className="h-4 w-4" /></button>;
      })}
    </div>
  );
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
    const responses = await Promise.all(
      pendingRemove.creations.map((creation) =>
        fetch("/api/creations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: creation.taskId || creation.id, action: "hide-from-recent" }),
        })
      )
    );
    if (responses.some((response) => !response.ok)) {
      showToast({ title: "Could not remove record", message: "Please try again.", variant: "error" });
      return;
    }
    pendingRemove.creations.forEach((creation) => onChange(creationIdentity(creation), { parameters: { ...creation.parameters, hiddenFromRecent: true } }));
    setPendingRemove(null);
  };

  if (runs.length === 0) {
    return (
      <div className="flex min-h-[45vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-ui-xl bg-surface-soft text-muted-foreground"><ImageIcon className="h-6 w-6" /></div>
        <h2 className="mt-5 font-display text-2xl font-medium text-foreground">Create your first piece</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Describe an image, video, or sound below. Every request stays paired with its result.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-12 px-4 pb-8 pt-8 sm:px-6 lg:px-8">
      {runs.map((run) => {
        const requestedCount = Math.max(...run.creations.map((item) => item.parameters?.outputCount || 1));
        const cells = [...run.creations];
        while (cells.length < requestedCount) {
          cells.push({ ...run.creations[0], id: `${run.id}-placeholder-${cells.length}`, urls: [], status: "generating", parameters: { ...run.creations[0].parameters, outputIndex: cells.length } });
        }
        return (
          <article key={run.id} className="space-y-4">
            <div className="flex justify-end">
              <div className="max-w-[88%] rounded-ui-xl rounded-br-sm bg-surface-strong px-4 py-3 text-sm leading-relaxed text-foreground sm:max-w-2xl">{run.prompt}</div>
            </div>

            <div className="rounded-ui-xl border border-border bg-background p-3 sm:p-4">
              <div className={`grid gap-3 ${cells.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                {cells.map((creation, index) => {
                  const url = creation.urls[0];
                  const key = `${creationIdentity(creation)}-${index}`;
                  if (creation.status === "deleted") {
                    return <div key={key} className="flex min-h-24 items-center justify-center rounded-ui-lg border border-dashed border-border bg-surface-soft px-4 text-center text-xs text-muted-foreground"><Trash2 className="mr-2 h-4 w-4" />Media deleted</div>;
                  }
                  if (["pending", "generating", "processing"].includes(creation.status)) {
                    return <div key={key} className="relative flex min-h-48 flex-col items-center justify-center overflow-hidden rounded-ui-lg bg-surface-soft"><div className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-soft via-background to-surface-strong/60" /><Loader2 className="relative h-6 w-6 animate-spin text-muted-foreground" /><p className="relative mt-3 text-xs font-medium text-muted-foreground">Generating result {index + 1}</p></div>;
                  }
                  if (creation.status === "failed") {
                    return <div key={key} className="flex min-h-48 flex-col items-center justify-center rounded-ui-lg border border-destructive/20 bg-destructive/5 px-5 text-center"><p className="text-sm font-medium text-destructive">Generation failed</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{creation.error || "Please reprompt and try again."}</p></div>;
                  }
                  if (!url) return null;
                  return (
                    <div key={key} className="group/result relative min-h-48 overflow-hidden rounded-ui-lg bg-surface-dark">
                      {creation.type === "image" ? <button type="button" onClick={() => setViewer({ creation, url })} className="flex h-full min-h-48 w-full items-center justify-center"><img src={url} alt={creation.prompt} className="max-h-[34rem] h-full w-full object-contain" /></button> : creation.type === "video" ? <VideoResult url={url} prompt={creation.prompt} onOpen={() => setViewer({ creation, url })} /> : <button type="button" onClick={() => setViewer({ creation, url })} className="flex min-h-48 w-full flex-col items-center justify-center bg-surface-dark px-6 text-stone-200"><Music className="h-10 w-10 text-stone-500" /><p className="mt-3 line-clamp-2 text-center text-xs text-stone-400">{creation.prompt}</p><audio src={url} controls onClick={(event) => event.stopPropagation()} className="mt-5 w-full max-w-md" /></button>}
                      <button type="button" onClick={() => setViewer({ creation, url })} className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-stone-950/70 text-white opacity-0 transition-all duration-300 group-hover/result:opacity-100" aria-label="Open media"><Maximize2 className="h-4 w-4" /></button>
                      <ResultActions creation={creation} url={url} onReference={() => onReference(creation, url)} onDelete={() => setPendingDelete({ creation, url })} />
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-3">
                <button type="button" onClick={() => onReprompt(run.creations[0])} className="flex h-9 items-center gap-1.5 rounded-ui px-2.5 text-xs font-medium text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground"><RefreshCw className="h-4 w-4" />Reprompt</button>
                <button type="button" onClick={() => onDetails(run)} className="flex h-9 items-center gap-1.5 rounded-ui px-2.5 text-xs font-medium text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground"><Settings2 className="h-4 w-4" />Details</button>
                <div className="relative ml-auto">
                  <button type="button" onClick={() => setOpenMenu(openMenu === run.id ? null : run.id)} className="flex h-9 w-9 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground" aria-label="More actions"><Ellipsis className="h-4 w-4" /></button>
                  {openMenu === run.id && <div className="absolute bottom-11 right-0 z-20 w-48 rounded-ui-lg border border-border bg-background p-1 shadow-float"><button type="button" onClick={() => { setOpenMenu(null); setPendingRemove(run); }} className="flex w-full items-center gap-2 rounded-ui px-3 py-2 text-left text-xs text-destructive transition-all duration-300 hover:bg-destructive/5"><Trash2 className="h-4 w-4" />Remove from recent</button></div>}
                </div>
              </div>
            </div>
          </article>
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
