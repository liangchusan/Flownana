"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, FileAudio, Image as ImageIcon, Loader2, Video, X } from "lucide-react";
import { ReferencePicker } from "./reference-picker";
import type { ReferenceMetadata } from "@/lib/reference-validation";
import type { GenerationInputCapabilities } from "@/lib/generation-input-capabilities";

export type ActiveComposerType = "image" | "video";
export interface ComposerAttachment extends ReferenceMetadata {
  id: string; url: string; name: string; source: "upload" | "asset" | "reference";
}
export type PendingComposerAttachment = Pick<ComposerAttachment, "id" | "kind" | "name" | "durationSeconds">;
export interface ComposerAssetOption extends ReferenceMetadata { id: string; url: string; name: string }
const interactive = "transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed";

function formatReferenceDuration(seconds: number | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

export function ComposerAttachments({ attachments, pendingAttachments = [], onRemove }: {
  attachments: ComposerAttachment[];
  pendingAttachments?: PendingComposerAttachment[];
  onRemove: (id: string) => void;
}) {
  const [videoDurations, setVideoDurations] = useState<Record<string, number>>({});
  const previews = [...attachments, ...pendingAttachments.map((attachment) => ({ ...attachment, pending: true as const }))];
  if (!previews.length) return null;
  return <div className="subtle-horizontal-scrollbar flex gap-2 overflow-x-auto pb-1" aria-label="Prompt attachments">{previews.map((a) => {
    const duration = a.kind === "video" ? formatReferenceDuration(a.durationSeconds ?? videoDurations[a.id]) : null;
    return <div key={a.id} className="group/reference relative h-20 w-20 shrink-0">
      <div className="flex size-full items-center justify-center overflow-hidden rounded-ui bg-surface-soft">{"pending" in a ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label={`Uploading ${a.name}`} /> : a.kind === "image" ? <img src={a.url} alt={a.name} className="size-full object-cover" /> : a.kind === "video" ? <video src={a.url} aria-label={a.name} muted playsInline preload="metadata" onLoadedMetadata={(event) => { const seconds = event.currentTarget.duration; if (Number.isFinite(seconds) && seconds > 0) setVideoDurations((current) => current[a.id] === seconds ? current : { ...current, [a.id]: seconds }); }} className="size-full object-cover" /> : <FileAudio className="h-5 w-5" />}</div>
      {duration && <span className="pointer-events-none absolute bottom-1 right-1 rounded-ui bg-stone-950/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">{duration}</span>}
      {!('pending' in a) && <button type="button" onClick={() => onRemove(a.id)} aria-label={`Remove ${a.name}`} className={`absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-stone-950/70 text-white shadow-soft transition-all duration-300 hover:bg-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:translate-y-1 sm:opacity-0 sm:group-hover/reference:translate-y-0 sm:group-hover/reference:opacity-100 sm:group-focus-within/reference:translate-y-0 sm:group-focus-within/reference:opacity-100`}><X className="h-3.5 w-3.5" /></button>}
    </div>;
  })}</div>;
}
export function CreationModeSelector({ value, onChange, menuPlacement = "above", disabled }: {
  value: "agent" | ActiveComposerType; onChange: (value: "agent" | ActiveComposerType) => void;
  menuPlacement?: "above" | "below"; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false); const root = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, []);
  const choices = [{ value: "agent" as const, label: "Agent", Icon: Bot }, { value: "image" as const, label: "Image", Icon: ImageIcon }, { value: "video" as const, label: "Video", Icon: Video }];
  const current = choices.find(c => c.value === value)!;
  return <div ref={root} className="relative shrink-0" onKeyDown={e => {
    if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); e.stopPropagation(); }
    if (["ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); if (!open) setOpen(true); else { const buttons = Array.from(root.current!.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')); const i = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[i < 0 ? (e.key === "ArrowDown" ? 0 : buttons.length - 1) : (i + (e.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus(); } }
  }}>
    <button ref={trigger} type="button" disabled={disabled} aria-label={`Creation mode: ${current.label}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)} className={`flex min-h-11 items-center gap-1.5 rounded-ui px-2 text-sm font-medium hover:bg-surface-soft ${interactive}`}><current.Icon className="h-4 w-4" /><span>{current.label}</span><ChevronDown className="h-4 w-4" /></button>
    {open && <div role="menu" aria-label="Creation mode" className={`absolute left-0 z-50 w-48 rounded-ui-lg border border-border bg-background p-1 shadow-float ${menuPlacement === "below" ? "top-full mt-2" : "bottom-full mb-2"}`}>{choices.map(c => <button key={c.value} type="button" role="menuitemradio" aria-checked={value === c.value} onClick={() => { onChange(c.value); setOpen(false); trigger.current?.focus(); }} className={`flex min-h-11 w-full items-center gap-3 rounded-ui px-3 text-left text-sm hover:bg-surface-soft ${interactive}`}><Check className={`h-4 w-4 ${value === c.value ? "" : "invisible"}`} /><c.Icon className="h-4 w-4" /><span>{c.label}</span></button>)}</div>}
  </div>;
}
export function ComposerToolbarLeading({ menuPlacement = "above", composerType, capabilities, attachments, onTypeChange, onAgent, onAdd, onBusyChange, onPendingChange }: {
  menuPlacement?: "above" | "below"; composerType: ActiveComposerType;
  capabilities: GenerationInputCapabilities; attachments: ComposerAttachment[]; assets?: ComposerAssetOption[];
  onTypeChange: (type: ActiveComposerType) => void; onAgent?: () => void;
  onAdd: (items: ComposerAttachment[]) => void; onBusyChange?: (busy: boolean) => void; onPendingChange?: (items: PendingComposerAttachment[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  return <><ReferencePicker capabilities={capabilities} attachments={attachments} onAdd={onAdd} menuPlacement={menuPlacement} onBusyChange={value => { setBusy(value); onBusyChange?.(value); }} onPendingChange={onPendingChange} /><CreationModeSelector value={composerType} menuPlacement={menuPlacement} disabled={busy} onChange={value => value === "agent" ? onAgent?.() : onTypeChange(value)} /></>;
}
