"use client";

import { useMemo, useState } from "react";
import { AtSign, Download, Image as ImageIcon, Music, Search, Trash2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResilientMedia } from "@/components/ui/resilient-media";
import { useToast } from "@/components/blocks/app-toast-provider";
import { creationIdentity, type CreationHistoryItem } from "@/lib/creation-history";
import { buildCreationDownloadPath } from "@/lib/creation-download";
import { trackEvent } from "@/lib/analytics";

type AssetFilter = "all" | CreationHistoryItem["type"];

interface AssetItem {
  id: string;
  creation: CreationHistoryItem;
  url: string;
  position: number;
}

export function AssetsLibrary({
  creations,
  onReference,
  onChange,
}: {
  creations: CreationHistoryItem[];
  onReference: (creation: CreationHistoryItem, url: string) => void;
  onChange: (identity: string, patch: Partial<CreationHistoryItem>) => void;
}) {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [preview, setPreview] = useState<AssetItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AssetItem | null>(null);

  const assets = useMemo(() => {
    const items: AssetItem[] = [];
    creations.forEach((creation) => {
      if (creation.status !== "success") return;
      creation.urls.forEach((url, position) => items.push({ id: `${creationIdentity(creation)}-${position}`, creation, url, position }));
    });
    return items
      .filter((asset) => filter === "all" || asset.creation.type === filter)
      .filter((asset) => !query.trim() || asset.creation.prompt.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => {
        const delta = new Date(b.creation.createdAt).getTime() - new Date(a.creation.createdAt).getTime();
        return sort === "newest" ? delta : -delta;
      });
  }, [creations, filter, query, sort]);

  const download = (asset: AssetItem) => {
    trackEvent("result_download_clicked", { type: asset.creation.type, source: "assets" });
    const link = document.createElement("a");
    link.href = buildCreationDownloadPath(
      asset.creation.taskId || asset.creation.id,
      asset.url
    );
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteAsset = async () => {
    if (!pendingDelete) return;
    const response = await fetch("/api/creations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pendingDelete.creation.taskId || pendingDelete.creation.id, action: "delete-media", url: pendingDelete.url }),
    });
    if (!response.ok) {
      showToast({ title: "Could not delete media", message: "Please try again.", variant: "error" });
      return;
    }
    const nextUrls = pendingDelete.creation.urls.filter((url) => url !== pendingDelete.url);
    onChange(creationIdentity(pendingDelete.creation), { urls: nextUrls, status: nextUrls.length ? "success" : "deleted" });
    setPendingDelete(null);
    setPreview(null);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Library</p><h1 className="mt-1 font-display text-3xl font-medium text-foreground">Assets</h1><p className="mt-1 text-sm text-muted-foreground">Successful generated media, ready to reuse.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 min-w-52 flex-1 items-center gap-2 rounded-ui border border-border bg-background px-3 lg:flex-none"><Search className="h-4 w-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search prompts" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label>
          <select value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest")} className="h-10 rounded-ui border border-border bg-background px-3 text-sm text-foreground outline-none"><option value="newest">Newest</option><option value="oldest">Oldest</option></select>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1" role="tablist" aria-label="Asset type">
        {([
          ["all", "All"], ["image", "Images"], ["video", "Videos"], ["music", "Audio"],
        ] as Array<[AssetFilter, string]>).map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id)} className={`h-9 rounded-ui px-3 text-sm transition-all duration-300 ${filter === id ? "bg-surface-strong text-foreground" : "text-muted-foreground hover:bg-surface-soft hover:text-foreground"}`}>{label}</button>)}
      </div>

      {assets.length === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center text-center"><ImageIcon className="h-10 w-10 text-stone-300" /><h2 className="mt-4 text-lg font-medium text-foreground">No matching assets</h2><p className="mt-1 text-sm text-muted-foreground">Successful generations will appear here.</p></div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {assets.map((asset) => (
            <article key={asset.id} className="group overflow-hidden rounded-ui-lg border border-border bg-background transition-all duration-300 hover:border-stone-300 hover:shadow-soft">
              <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-surface-dark">
                {asset.creation.type === "image" ? <ResilientMedia creationId={asset.creation.taskId || asset.creation.id} url={asset.url} label="Image" className="h-full min-h-0">{({ src, onError, onReady }) => <button type="button" onClick={() => setPreview(asset)} className="h-full w-full"><img src={src} alt={asset.creation.prompt} onError={onError} onLoad={onReady} className="h-full w-full object-contain" loading="lazy" /></button>}</ResilientMedia> : asset.creation.type === "video" ? <ResilientMedia creationId={asset.creation.taskId || asset.creation.id} url={asset.url} label="Video" className="h-full min-h-0">{({ src, onError, onReady }) => <button type="button" onClick={() => setPreview(asset)} className="h-full w-full"><video src={src} muted playsInline preload="metadata" onError={onError} onLoadedData={onReady} className="h-full w-full object-contain" /></button>}</ResilientMedia> : <button type="button" onClick={() => setPreview(asset)} className="flex h-full w-full items-center justify-center"><Music className="h-10 w-10 text-stone-500" /></button>}
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-stone-950/70 px-2 py-1 text-[10px] font-medium text-white">{asset.creation.type === "image" ? <ImageIcon className="h-3 w-3" /> : asset.creation.type === "video" ? <Video className="h-3 w-3" /> : <Music className="h-3 w-3" />}{asset.creation.type === "music" ? "Audio" : asset.creation.type}</span>
              </div>
              <div className="p-3"><p className="line-clamp-2 min-h-10 text-xs leading-relaxed text-foreground">{asset.creation.prompt}</p><div className="mt-3 flex items-center justify-end gap-1"><button type="button" onClick={() => onReference(asset.creation, asset.url)} className="flex h-8 w-8 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground" aria-label="Reference asset"><AtSign className="h-4 w-4" /></button><button type="button" onClick={() => download(asset)} className="flex h-8 w-8 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground" aria-label="Download asset"><Download className="h-4 w-4" /></button><button type="button" onClick={() => setPendingDelete(asset)} className="flex h-8 w-8 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-destructive/5 hover:text-destructive" aria-label="Delete asset"><Trash2 className="h-4 w-4" /></button></div></div>
            </article>
          ))}
        </div>
      )}

      {preview && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-surface-dark/95 p-4" role="dialog" aria-modal="true"><button type="button" onClick={() => setPreview(null)} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"><X className="h-5 w-5" /></button>{preview.creation.type === "image" ? <ResilientMedia creationId={preview.creation.taskId || preview.creation.id} url={preview.url} label="Image" className="max-w-xl rounded-ui-xl">{({ src, onError, onReady }) => <img src={src} alt={preview.creation.prompt} onError={onError} onLoad={onReady} className="max-h-[88vh] max-w-[92vw] rounded-ui-xl object-contain" />}</ResilientMedia> : preview.creation.type === "video" ? <ResilientMedia creationId={preview.creation.taskId || preview.creation.id} url={preview.url} label="Video" className="max-w-xl rounded-ui-xl">{({ src, onError, onReady }) => <video src={src} controls autoPlay playsInline onError={onError} onLoadedData={onReady} className="max-h-[88vh] max-w-[92vw] rounded-ui-xl object-contain" />}</ResilientMedia> : <div className="w-full max-w-xl rounded-ui-xl bg-surface-elevated p-8 text-center text-white"><Music className="mx-auto h-12 w-12 text-stone-400" /><p className="mt-4 text-sm text-stone-300">{preview.creation.prompt}</p><div className="relative mt-6 overflow-hidden rounded-ui-lg"><ResilientMedia creationId={preview.creation.taskId || preview.creation.id} url={preview.url} label="Audio" className="min-h-32 rounded-ui-lg">{({ src, onError, onReady }) => <audio src={src} controls autoPlay onError={onError} onCanPlay={onReady} className="w-full" />}</ResilientMedia></div></div>}</div>}
      {pendingDelete && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/25 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-ui-xl border border-border bg-background p-6 shadow-float"><h2 className="text-lg font-medium text-foreground">Delete this asset?</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">It will disappear from Assets and become a deleted placeholder in its Create record.</p><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button><Button onClick={deleteAsset} className="bg-destructive text-white hover:bg-destructive/90">Delete</Button></div></div></div>}
    </div>
  );
}
