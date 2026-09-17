"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileAudio, FolderOpen, Plus, Search, Upload, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/blocks/app-toast-provider";
import { useAccountOperation } from "@/lib/use-account-operation";
import { uploadAccountMedia } from "@/lib/account-media-upload";
import { signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import { isAccountOperationCancelled, type CaptureAccountOperation } from "@/lib/account-operation";
import { referenceBatchIssue, referenceIssue, referenceLimit, type ReferenceMetadata } from "@/lib/reference-validation";
import { MEDIA_UPLOAD_RULES } from "@/lib/media-upload-policy";
import type { GenerationInputCapabilities, ComposerAttachmentKind } from "@/lib/generation-input-capabilities";
import type { ComposerAttachment, ComposerAssetOption } from "./composer-input-controls";
import type { PendingComposerAttachment } from "./composer-input-controls";
import type { CreationHistoryItem } from "@/lib/creation-history";

const interactive = "transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
type Job = { id: string; file: File; kind: ComposerAttachmentKind; state: "waiting" | "uploading"; metadata?: ReferenceMetadata; url?: string };
function kindOf(file: File): ComposerAttachmentKind | null { return file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : null; }

async function localMetadata(file: File, kind: ComposerAttachmentKind): Promise<ReferenceMetadata> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const element = kind === "image" ? new Image() : document.createElement(kind);
      const cleanup = () => { clearTimeout(timeout); element.onerror = null; if (element instanceof HTMLMediaElement) { element.onloadedmetadata = null; element.removeAttribute("src"); element.load(); } else { element.onload = null; } };
      const fail = () => { cleanup(); reject(new Error("Could not read this file. Try exporting it again.")); };
      const done = () => {
        const durationSeconds = element instanceof HTMLMediaElement ? element.duration : undefined;
        cleanup();
        if (durationSeconds != null && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) { reject(new Error("Could not read the duration.")); return; }
        resolve({ kind, contentType: file.type, sizeBytes: file.size, durationSeconds });
      };
      const timeout = setTimeout(fail, 15_000);
      element.onerror = fail;
      if (element instanceof HTMLImageElement) element.onload = done;
      else { element.preload = "metadata"; element.onloadedmetadata = done; }
      element.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}
async function inspect(asset: { url: string; kind: ComposerAttachmentKind }, fromAssets: boolean, op: ReturnType<CaptureAccountOperation>): Promise<ReferenceMetadata & { url: string }> {
  const res = await fetch("/api/creations/inspect", { method: "POST", headers: { ...op.headers, "Content-Type": "application/json" }, signal: AbortSignal.any([op.signal, AbortSignal.timeout(45_000)]), body: JSON.stringify({ ...asset, asset: fromAssets }) });
  const result = await res.json(); op.assertCurrent();
  if (!res.ok) throw new Error(result.error || "Could not check this file.");
  return result;
}

export function ReferencePicker({ capabilities, attachments, onAdd, menuPlacement = "above", onBusyChange, onPendingChange, disabled, onLogin }: {
  capabilities: GenerationInputCapabilities; attachments: ComposerAttachment[];
  onAdd: (items: ComposerAttachment[]) => void; menuPlacement?: "above" | "below";
  onBusyChange?: (busy: boolean) => void; onPendingChange?: (items: PendingComposerAttachment[]) => void; disabled?: boolean; onLogin?: () => void;
}) {
  const { status } = useSession();
  const { accountScope, capture } = useAccountOperation();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false), [assetsOpen, setAssetsOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const cancelledJobs = useRef(new Set<string>());
  const jobControllers = useRef(new Map<string, AbortController>());
  const root = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), lock = useRef(false);
  const live = useRef({ capabilities, attachments, onAdd }); live.current = { capabilities, attachments, onAdd };
  const busyCallback = useRef(onBusyChange); busyCallback.current = onBusyChange;
  const pendingCallback = useRef(onPendingChange); pendingCallback.current = onPendingChange;
  useEffect(() => { busyCallback.current?.(jobs.length > 0); }, [jobs]);
  useEffect(() => { pendingCallback.current?.(jobs.flatMap((job) => job.state === "uploading" && job.metadata ? [{ id: job.id, kind: job.kind, name: job.file.name, durationSeconds: job.metadata.durationSeconds }] : [])); }, [jobs]);
  useEffect(() => () => { for (const controller of jobControllers.current.values()) controller.abort(); busyCallback.current?.(false); }, []);
  useEffect(() => { setJobs([]); setOpen(false); setAssetsOpen(false); }, [accountScope]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);
  const login = () => { if (onLogin) onLogin(); else void signInForCurrentEnvironment(); };
  const run = async (batch: Job[]) => {
    if (lock.current || disabled) return;
    lock.current = true;
    let op: ReturnType<CaptureAccountOperation>;
    try { op = capture(); } catch { lock.current = false; login(); return; }
    const added: ComposerAttachment[] = [];
    try {
      for (const job of batch) {
        op.assertCurrent();
        if (cancelledJobs.current.has(job.id)) continue;
        const controller = new AbortController(); jobControllers.current.set(job.id, controller);
        const signal = AbortSignal.any([op.signal, controller.signal, AbortSignal.timeout(180_000)]);
        const fileOp = { ...op, signal, assertCurrent: () => { op.assertCurrent(); signal.throwIfAborted(); } };
        try {
          const local = await localMetadata(job.file, job.kind); fileOp.assertCurrent();
          const issue = referenceIssue(live.current.capabilities, local, { upload: true, requireMetadata: true });
          if (issue) throw new Error(issue);
          const existing = [...live.current.attachments, ...added.filter(a => !live.current.attachments.some(b => b.id === a.id))];
          const batchIssue = referenceBatchIssue(live.current.capabilities, [...existing, local]);
          if (batchIssue) throw new Error(batchIssue);
          setJobs(current => current.map(j => j.id === job.id ? { ...j, state: "uploading", metadata: local } : j));
          const url = job.url ?? (await uploadAccountMedia(job.file, job.kind, fileOp)).url;
          op.assertCurrent();
          // Save the uploaded URL for verification retries; don't upload successful bytes twice.
          setJobs(current => current.map(j => j.id === job.id ? { ...j, url } : j));
          const metadata = await inspect({ url, kind: job.kind }, false, fileOp);
          const verifiedIssue = referenceIssue(live.current.capabilities, metadata, { upload: true, requireMetadata: true });
          if (verifiedIssue) throw new Error(verifiedIssue);
          const verifiedBatchIssue = referenceBatchIssue(live.current.capabilities, [...live.current.attachments, ...added.filter(a => !live.current.attachments.some(b => b.id === a.id)), metadata]);
          if (verifiedBatchIssue) throw new Error(verifiedBatchIssue);
          const item: ComposerAttachment = { id: job.id, ...metadata, name: job.file.name, source: "upload" };
          fileOp.assertCurrent();
          added.push(item); live.current.onAdd([item]);
          setJobs(current => current.filter(j => j.id !== job.id));
        } catch (e) {
          if (op.signal.aborted) throw e;
          if (cancelledJobs.current.has(job.id)) continue;
          setJobs(current => current.filter(j => j.id !== job.id));
          showToast({ message: e instanceof Error ? e.message : "Could not add this reference. Try another file.", variant: "warning" });
        } finally { jobControllers.current.delete(job.id); cancelledJobs.current.delete(job.id); }
      }
    } finally { lock.current = false; }
  };
  const chooseFiles = (files: FileList | null) => {
    if (!files?.length || lock.current) return;
    const batch: Job[] = Array.from(files).map(file => ({ id: crypto.randomUUID(), file, kind: kindOf(file) ?? "image", state: "waiting" }));
    const pending = jobs.map(j => ({ kind: j.kind }));
    for (const kind of ["image", "video", "audio"] as const) {
      const selected = batch.filter(j => j.kind === kind).length;
      const remaining = referenceLimit(capabilities, kind) - attachments.filter(a => a.kind === kind).length - pending.filter(a => a.kind === kind).length;
      if (selected > remaining) { showToast({ message: `Selected ${selected} ${kind} files; ${Math.max(0, remaining)} slots remain. Choose fewer files.`, variant: "warning" }); if (input.current) input.current.value = ""; return; }
    }
    if (capabilities.maxReferences && attachments.length + jobs.length + batch.length > capabilities.maxReferences) { showToast({ message: `Keep at most ${capabilities.maxReferences} references.`, variant: "warning" }); return; }
    setJobs(current => [...current, ...batch]);
    setOpen(false);
    void run(batch).catch(() => undefined);
    if (input.current) input.current.value = "";
  };
  const accepted = (["image", "video", "audio"] as const).flatMap(kind => referenceLimit(capabilities, kind) ? MEDIA_UPLOAD_RULES[kind].types.filter(type => kind !== "image" || !capabilities.imageContentTypes || capabilities.imageContentTypes.includes(type)) : []).join(",");
  return <div ref={root} className="relative shrink-0">
    <button type="button" aria-label="Add input" aria-expanded={open} onClick={() => setOpen(v => !v)} disabled={disabled || status === "loading"} className={`flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-soft ${interactive}`}><Plus className="h-4 w-4" /></button>
    <input hidden ref={input} type="file" accept={accepted} multiple onChange={e => chooseFiles(e.target.files)} />
    {open && <div className={`absolute left-0 z-50 max-h-[60dvh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-ui-lg border border-border bg-background p-2 shadow-float ${menuPlacement === "below" ? "top-full mt-2" : "bottom-full mb-2"}`}>
      <button type="button" disabled={lock.current || disabled} onClick={() => accountScope ? input.current?.click() : login()} className={`flex min-h-11 w-full items-center gap-3 rounded-ui px-3 text-sm hover:bg-surface-soft ${interactive}`}><Upload className="h-4 w-4" />Upload files</button>
      <button type="button" disabled={jobs.length > 0 || disabled} onClick={() => { if (!accountScope) { login(); return; } setOpen(false); setAssetsOpen(true); }} className={`flex min-h-11 w-full items-center gap-3 rounded-ui px-3 text-sm hover:bg-surface-soft ${interactive}`}><FolderOpen className="h-4 w-4" />Choose from Assets</button>
    </div>}
    {assetsOpen && <AssetsPicker capabilities={capabilities} attachments={attachments} capture={capture} onClose={() => setAssetsOpen(false)} onAdd={onAdd} />}
  </div>;
}

function AssetsPicker({ capabilities, attachments, capture, onClose, onAdd }: { capabilities: GenerationInputCapabilities; attachments: ComposerAttachment[]; capture: CaptureAccountOperation; onClose: () => void; onAdd: (items: ComposerAttachment[]) => void }) {
  const [assets, setAssets] = useState<ComposerAssetOption[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [search, setSearch] = useState(""), [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<ComposerAttachment[]>([]), [checking, setChecking] = useState<string | null>(null);
  const { showToast } = useToast();
  const [version, setVersion] = useState(0);
  const alive = useRef(true), lock = useRef(false), controller = useRef(new AbortController());
  useEffect(() => { alive.current = true; controller.current = new AbortController(); return () => { alive.current = false; controller.current.abort(); }; }, []);
  const captureModal = () => { const op = capture(); const signal = AbortSignal.any([op.signal, controller.current.signal]); return { ...op, signal, assertCurrent: () => { op.assertCurrent(); signal.throwIfAborted(); } }; };
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError("");
      try {
        const op = capture();
        const res = await fetch("/api/creations", { headers: op.headers, signal: AbortSignal.any([op.signal, controller.current.signal, AbortSignal.timeout(30_000)]), cache: "no-store" });
        const data = await res.json(); op.assertCurrent(); if (!res.ok) throw new Error("Could not load Assets. Retry to continue.");
        if (cancelled) return;
        const rows: CreationHistoryItem[] = data.creations;
        setAssets(rows.filter(c => c.status === "success").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).flatMap(c => c.urls.map((url, index) => ({ id: `${c.id}-${index}`, url, kind: c.type === "music" ? "audio" as const : c.type, name: c.prompt || `${c.type} result`, durationSeconds: c.parameters?.duration }))));
      } catch (e) { if (!cancelled && !isAccountOperationCancelled(e)) setError(e instanceof Error ? e.message : "Could not load Assets."); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load(); return () => { cancelled = true; };
  }, [capture, version]);
  const toggle = async (asset: ComposerAssetOption) => {
    if (lock.current) return;
    if (selected.some(a => a.id === asset.id)) { setSelected(current => current.filter(a => a.id !== asset.id)); return; }
    const capacity = referenceBatchIssue(capabilities, [...attachments, ...selected, { kind: asset.kind }]);
    if (capacity) { showToast({ title: "Reference limit reached", message: capacity, variant: "warning" }); return; }
    lock.current = true;
    const optimistic: ComposerAttachment = { ...asset, source: "asset" };
    setSelected(current => [...current, optimistic]);
    try {
      const op = captureModal(); const metadata = await inspect(asset, true, op);
      if (!alive.current) return;
      const item: ComposerAttachment = { ...asset, ...metadata, source: "asset" };
      const issue = referenceBatchIssue(capabilities, [...attachments, ...selected, item]);
      if (issue) throw new Error(issue);
      setSelected(current => current.map(selectedItem => selectedItem.id === asset.id ? item : selectedItem));
    } catch (e) {
      if (alive.current) setSelected(current => current.filter(selectedItem => selectedItem.id !== asset.id));
      if (alive.current && !isAccountOperationCancelled(e)) showToast({ title: "Could not select asset", message: e instanceof Error ? e.message : "Could not check this asset.", variant: "warning" });
    }
    finally { lock.current = false; }
  };
  const add = async () => {
    if (lock.current || !selected.length) return;
    lock.current = true; setChecking("all"); setError("");
    try {
      const op = captureModal(); const verified: ComposerAttachment[] = [];
      for (const item of selected) {
        try { verified.push({ ...item, ...await inspect(item, true, op) }); }
        catch { throw new Error("A selected asset is no longer available. Remove it and choose another."); }
      }
      if (!alive.current) return;
      const issue = referenceBatchIssue(capabilities, [...attachments, ...verified]);
      if (issue) throw new Error(issue);
      onAdd(verified); onClose();
    } catch (e) { if (alive.current && !isAccountOperationCancelled(e)) showToast({ message: e instanceof Error ? e.message : "Some assets could not be added. Review your selection.", variant: "warning" }); }
    finally { lock.current = false; if (alive.current) setChecking(null); }
  };
  const visible = assets.filter(a => (filter === "all" || a.kind === filter) && a.name.toLowerCase().includes(search.toLowerCase()));
  return <Modal onClose={onClose} aria-label="Choose from Assets" className="flex items-center justify-center bg-foreground/30 p-2 sm:p-6" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="flex h-[90dvh] max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-ui-xl border border-border bg-background shadow-float">
      <header className="shrink-0 border-b border-border px-4 pb-4 pt-2 sm:px-6"><div className="flex items-center justify-between"><h2 className="text-lg font-medium">Choose from Assets</h2><button type="button" aria-label="Close Assets" onClick={onClose} className={`flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-soft ${interactive}`}><X className="h-5 w-5" /></button></div>
        <label className="mt-3 flex min-h-11 items-center gap-2 rounded-ui border border-input px-3"><Search className="h-4 w-4 text-muted-foreground" /><input autoFocus aria-label="Search Assets by prompt" placeholder="Search by prompt" value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        <div className="mt-3 flex gap-2">{["all", "image", "video", "audio"].map(k => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`min-h-11 rounded-full px-4 text-sm ${interactive} ${filter === k ? "bg-surface-strong" : "hover:bg-surface-soft"}`}>{k === "all" ? "All" : k === "audio" ? "Audio" : `${k[0].toUpperCase()}${k.slice(1)}s`}</button>)}</div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? <p role="status" className="py-12 text-center text-muted-foreground">Loading Assets…</p> : !visible.length ? <p className="py-12 text-center text-muted-foreground">{assets.length ? "No matching assets. Try another search or filter." : "No saved results yet. Your generated images and videos will appear here."}</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{visible.map(asset => {
          const chosen = selected.some(a => a.id === asset.id), already = attachments.some(a => a.url === asset.url);
          return <button key={asset.id} type="button" aria-pressed={chosen} aria-disabled={already} aria-label={already ? `${asset.name} is already added` : `${chosen ? "Deselect" : "Select"} ${asset.name}`} disabled={!!checking || already} onClick={() => void toggle(asset)} className={`group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-ui-lg border bg-surface-soft ${interactive} ${chosen ? "border-brand-blue ring-2 ring-ring" : "border-border hover:border-input"}`}>
            <AssetThumbnail asset={asset} />
            {chosen && <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-background text-brand-blue shadow-soft"><Check className="h-4 w-4" /></span>}
            {already && <span className="absolute inset-0 flex items-center justify-center bg-foreground/35 px-3 text-center text-xs font-medium text-background">Already added</span>}
          </button>;
        })}</div>}
      </div>
      <footer className="shrink-0 border-t border-border p-4 sm:px-6">
        {error && <div role="alert" className="mb-2 text-sm text-destructive">{error} {!selected.length && <button type="button" onClick={() => setVersion(v => v + 1)} className={`min-h-11 px-2 underline ${interactive}`}>Retry</button>}</div>}
        <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground" aria-live="polite">{selected.length} selected</span><div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!selected.length || !!checking} onClick={() => void add()}>{checking === "all" ? "Checking…" : `Add ${selected.length} assets`}</Button></div></div>
      </footer>
    </section>
  </Modal>;
}
function AssetThumbnail({ asset }: { asset: ComposerAssetOption }) {
  const [duration, setDuration] = useState(asset.durationSeconds);
  if (asset.kind === "image") return <img loading="lazy" src={asset.url} alt="" className="h-full w-full object-cover" />;
  if (asset.kind === "audio") return <FileAudio className="h-8 w-8 text-muted-foreground" />;
  return <><video src={asset.url} muted playsInline preload="metadata" onLoadedMetadata={e => setDuration(e.currentTarget.duration)} className="h-full w-full object-cover" />{duration != null && <span className="absolute bottom-2 left-2 rounded-ui bg-background px-2 py-1 text-xs">{duration.toFixed(1)}s</span>}</>;
}
