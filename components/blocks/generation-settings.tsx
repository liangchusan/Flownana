"use client";

import { useId, useState, useLayoutEffect, useRef } from "react";
import { Check, ChevronDown, Maximize } from "lucide-react";

const descriptions: Record<string, string> = {
  "GPT Image 2": "Create and edit images with one reference, up to 4K.",
  "Nano Banana 2": "Generate images from text or a single reference, from 1K to 4K.",
  "Qwen Image 3.0 Pro": "Combine up to three reference images in 1K or 2K.",
  "Grok Imagine Image 2.0": "Create and edit with up to five reference images.",
  "Seedream 5.0 Pro": "Work with up to ten reference images in 1K or 2K.",
  "GPT-Image-2.5 Flare": "Create and edit with up to sixteen references, up to 4K.",
  "GPT-Image-2.5 Sunburst": "Generate up to 4K images with multi-image references and flexible framing.",
  "Seedance 2.0 Mini": "Combine image, video and audio references in 4–15 second clips.",
  "Gemini Omni Video": "Create up to 4K video with sound and up to seven reference images.",
  "Wan 3.0 Video": "Generate up to 30 seconds, with image, video and audio references.",
  "MiniMax H3": "Guide 4–15 second clips with optional first and last frames.",
  "Grok Imagine Video 1.5": "Turn a single image into a 1–15 second video.",
  "HappyHorse 1.1": "Create 3–15 second videos from text or an image, up to 1080P.",
};
const interaction = "transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const shapes: Record<string, string> = {
  "21:9": "h-2 w-5", "16:9": "h-3 w-5", "4:3": "h-3 w-4", "1:1": "h-3.5 w-3.5",
  "3:4": "h-4 w-3", "9:16": "h-5 w-3",
};

export function GenerationSettings({ models, model, onModel, ratios, ratio, onRatio, resolutions, resolution, onResolution, count, onCount, durations, duration, onDuration, followsImage = false, notice, placement = "below" }: {
  models: Array<{ id: string; label: string }>; model: string; onModel: (value: string) => void;
  ratios: string[]; ratio: string; onRatio: (value: string) => void;
  resolutions: string[]; resolution: string; onResolution: (value: string) => void;
  count?: number; onCount?: (value: number) => void;
  durations?: number[]; duration?: number; onDuration?: (value: number) => void;
  followsImage?: boolean; notice?: string; placement?: "above" | "below" | "auto";
}) {
  const [open, setOpen] = useState(false);
  const [resolvedPlacement, setResolvedPlacement] = useState<"above" | "below">("below");
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      if (!root.current || !panel.current) return;
      const anchor = root.current.getBoundingClientRect();
      const width = panel.current.getBoundingClientRect().width;
      const left = Math.max(16, Math.min(anchor.left, window.innerWidth - width - 16));
      const boundary = root.current.closest<HTMLElement>("[data-settings-boundary]")?.getBoundingClientRect();
      const boundaryTop = Math.max(16, boundary?.top ?? 16);
      const boundaryBottom = Math.min(window.innerHeight - 16, boundary?.bottom ?? window.innerHeight - 16);
      const spaceBelow = boundaryBottom - anchor.bottom - 12;
      const spaceAbove = anchor.top - boundaryTop - 12;
      const nextPlacement = placement === "auto" ? (spaceBelow >= 360 || spaceBelow >= spaceAbove ? "below" : "above") : placement;
      const availableSpace = nextPlacement === "below" ? spaceBelow : spaceAbove;
      panel.current.style.setProperty("--settings-offset", `${left - anchor.left}px`);
      panel.current.style.setProperty("max-height", `${Math.max(0, availableSpace)}px`);
      setResolvedPlacement(nextPlacement);
    };
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); } };
    position();
    panel.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus({ preventScroll: true });
    window.addEventListener("resize", position);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { window.removeEventListener("resize", position); document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open, placement]);
  const name = models.find(m => m.id === model)?.label ?? model;
  const ratioLabel = followsImage ? "Follows input image" : ratio.toLowerCase() === "auto" ? "Auto" : ratio;
  const summary = `${ratioLabel}${resolutions.length ? ` · ${resolution}` : ""} · ${count ? `${count} ${count === 1 ? "image" : "images"}` : `${duration}s`}`;
  return <div ref={root} className="relative min-w-0 flex-1" onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <button ref={trigger} type="button" aria-label={`Model and settings: ${name}, ${summary}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? titleId + "-panel" : undefined} onClick={() => setOpen(value => !value)}
      className={`flex min-h-11 w-full min-w-0 items-center gap-1.5 rounded-ui px-2 text-left text-xs hover:bg-surface-soft active:bg-surface-strong ${interaction}`}>
      <span className="min-w-0 truncate font-medium">{name}</span>
      <span className="hidden shrink-0 text-muted-foreground lg:inline">· {summary}</span>
      <ChevronDown className="h-4 w-4 shrink-0" />
    </button>
    {open && <section ref={panel} id={titleId + "-panel"} role="dialog" aria-modal="false" aria-label="Model and settings"
      className={`absolute left-[var(--settings-offset,0px)] ${resolvedPlacement === "above" ? "bottom-full mb-3" : "top-full mt-3"} z-50 flex h-[min(22.5rem,calc(100dvh-14rem))] w-[min(42.5rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-ui-xl border border-border bg-background shadow-float`}>
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] overflow-hidden md:grid-cols-5 md:grid-rows-1">
          <div className="min-h-0 overscroll-contain overflow-y-auto border-b border-border p-3 md:col-span-2 md:max-h-none md:border-b-0 md:border-r">
            <p className="pl-7 pr-2 pb-3 text-xs font-medium text-muted-foreground">Models</p>
            <div role="group" aria-label="Models" className="space-y-1">
              {models.map(m => <button key={m.id} type="button" aria-pressed={m.id === model} onClick={() => onModel(m.id)}
                className={`relative block min-h-11 w-full rounded-ui-lg py-2.5 pl-7 pr-2 text-left active:bg-surface-strong ${interaction} ${m.id === model ? "bg-surface-soft" : "hover:bg-surface-soft"}`}>
                <Check className={`absolute left-1 top-3 h-4 w-4 ${m.id === model ? "text-foreground" : "invisible"}`} />
                <span className="min-w-0"><span className="block text-sm font-medium">{m.label}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{descriptions[m.label]}</span></span>
              </button>)}
            </div>
          </div>
          <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-4 md:col-span-3 md:p-5">
            <fieldset><legend className="mb-2 text-xs font-medium text-muted-foreground">Aspect ratio</legend>
              {followsImage ? <p className="rounded-ui bg-surface-soft px-3 py-2.5 text-xs">Follows input image</p> : <div className="flex flex-wrap gap-1 rounded-ui-lg bg-surface-soft p-1">
                {ratios.map(r => <button key={r} type="button" aria-pressed={r === ratio} onClick={() => onRatio(r)} className={`flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-1.5 rounded-ui px-1.5 text-[11px] ${interaction} ${r === ratio ? "bg-background text-foreground shadow-soft" : "text-muted-foreground hover:bg-surface-strong"}`}>
                  <span className="flex h-5 items-center justify-center">{r.toLowerCase() === "auto" ? <Maximize className="h-3.5 w-3.5" /> : <span aria-hidden="true" className={`block rounded-sm border border-current ${shapes[r]}`} />}</span>
                  {r.toLowerCase() === "auto" ? "Auto" : r}
                </button>)}
              </div>}
            </fieldset>
            {!!resolutions.length && <ChoiceGroup label="Resolution" values={resolutions} value={resolution} onChange={onResolution} />}
            {onCount && <ChoiceGroup label="Images" values={["1", "2", "3", "4"]} value={String(count)} onChange={v => onCount(Number(v))} />}
            {durations && onDuration && <fieldset><legend className="mb-2 text-xs font-medium text-muted-foreground">Video length</legend>
              <div className="rounded-ui-lg bg-surface-soft p-3">
                <p className="mb-1 text-right text-sm font-medium" aria-live="polite">{duration}s</p>
                <input type="range" min={0} max={Math.max(0, durations.length - 1)} step={1} value={Math.max(0, durations.indexOf(duration ?? 0))} disabled={durations.length < 2} aria-label="Video duration" aria-valuetext={`${duration} seconds`} onChange={e => onDuration(durations[Number(e.target.value)])} className={`h-6 w-full cursor-pointer accent-primary ${interaction}`} />
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground"><span>{durations[0]}s</span><span>{durations.at(-1)}s</span></div>
              </div>
            </fieldset>}
            {notice && <p role="status" className="text-xs leading-relaxed text-muted-foreground">{notice}</p>}
          </div>
        </div>

    </section>}
  </div>;
}
function ChoiceGroup({ label, values, value, onChange }: { label: string; values: string[]; value: string; onChange: (value: string) => void }) {
  return <fieldset><legend className="mb-2 text-xs font-medium text-muted-foreground">{label}</legend><div className="flex rounded-full bg-surface-soft p-1">{values.map(v => <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)} className={`min-h-11 flex-1 rounded-full px-2 text-xs md:min-h-8 ${interaction} ${v === value ? "bg-background text-foreground shadow-soft" : "text-muted-foreground hover:bg-surface-strong"}`}>{v}</button>)}</div></fieldset>;
}
