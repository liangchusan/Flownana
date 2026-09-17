"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Pencil, Trash2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";
import { GenerationSettings } from "@/components/blocks/generation-settings";
import { WorkspaceMobileHeader, WorkspaceSidebar } from "@/components/blocks/workspace-sidebar";
import { LegacyAgentDraft } from "./legacy-draft";
import { ResilientMedia } from "@/components/ui/resilient-media";
import { AgentComposer, type AgentDraft } from "./agent-composer";
import { ResultOverlayActions, VideoResult } from "@/components/blocks/creation-stream";
import { getAccountScope } from "@/lib/account-scope";
import { useAccountOperation } from "@/lib/use-account-operation";
import { imageTemplates } from "@/lib/image-templates/catalog";
import { trackEvent } from "@/lib/analytics";
import { buildCreationDownloadPath } from "@/lib/creation-download";
import { signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import type { AgentSnapshot, AgentTurnView, AgentOutput } from "./types";
import { fetchAgentSnapshot } from "@/lib/shared-agent-read";
import { IMAGE_MODEL_OPTION_MAP, IMAGE_MODEL_OPTIONS, VIDEO_MODEL_OPTIONS, getVideoModelName } from "@/lib/generation-pricing";
import { getImageAspectRatios } from "@/lib/image-model-capabilities";
import type { AgentQuote } from "@/lib/agent/contract";

export function AgentWorkspace(props: { id?: string; templateId?: string; sourceId?: string }) {
  const { data: session } = useSession();
  return <ScopedAgentWorkspace key={`${getAccountScope(session?.user) ?? "anonymous"}:${props.id ?? props.templateId ?? "new"}`} {...props} />;
}
function ScopedAgentWorkspace({ id, templateId, sourceId }: { id?: string; templateId?: string; sourceId?: string }) {
  const router = useRouter();
  const { data: session, status } = useSession(), { capture } = useAccountOperation();
  const scope = getAccountScope(session?.user);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [snapshot, setSnapshot] = useState<AgentSnapshot | null>(null), [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState(false), [mobileOpen, setMobileOpen] = useState(false);
  const [busy, setBusy] = useState(false), [editingTitle, setEditingTitle] = useState<string | null>(null), [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<AgentOutput | null>(null), [seed, setSeed] = useState<(AgentDraft & { key: string; autoSend?: boolean }) | undefined>();
  const [pendingOutputDelete, setPendingOutputDelete] = useState<AgentOutput | null>(null);
  const observedTurns = useRef(new Set<string>());
  const retryIds = useRef(new Map<string, string>());
  const bottom = useRef<HTMLDivElement>(null), observed = useRef(new Set<string>()), ended = useRef(new Set<string>());
  const template = imageTemplates.find(t => t.id === (snapshot?.conversation?.templateId ?? templateId));
  const poll = useCallback(async () => {
    if (!scope) return;
    const op = capture();
    try {
      const { ok, data } = await fetchAgentSnapshot(scope, id, op.signal);
      op.assertCurrent();
      if (!ok) { setError(data.error ?? "Could not load conversation."); setCleanupPending(data.code === "cleanup_pending"); return; }
      if (data.accountScope !== scope) return;
      setSnapshot(data);
      let intent = data.turns[0]?.id;
      for (const turn of data.turns as AgentTurnView[]) {
        if (turn.status === "running") observedTurns.current.add(turn.id);
        if (template && turn.status === "completed" && observedTurns.current.has(turn.id)) {
          const event = turn.responseKind === "question" ? "clarification_started" : turn.quote ? "clarification_completed" : null;
          if (event) { const key = `agent-clarification:${scope}:${intent}:${event}`; try { if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, "1"); trackEvent(event, { template_id: template.id }); } } catch { /* Optional analytics storage. */ } }
          observedTurns.current.delete(turn.id);
        }
        if (turn.quote) intent = turn.id;
      }
      for (const output of data.outputs as AgentOutput[]) {
        if (["pending", "processing", "generating"].includes(output.status)) observed.current.add(output.id);
        if (observed.current.has(output.id) && ["success", "failed"].includes(output.status) && !ended.current.has(output.id)) {
          ended.current.add(output.id);
          const key = `template-result:${scope}:${output.id}`;
          let tracked = false; try { tracked = !!sessionStorage.getItem(key); sessionStorage.setItem(key, "1"); } catch { /* In-memory dedup remains. */ }
          if (!tracked) trackEvent(output.status === "success" ? "generation_success" : "generation_failed", { type: output.type, model: String(output.parameters.model), template_id: template?.id, source: "agent" });
        }
      }
      await Promise.allSettled((data.outputs as AgentOutput[]).filter(o => o.type === "video" && o.taskId && ["pending", "processing", "generating"].includes(o.status)).map(o => fetch(`/api/veo/generate?taskId=${encodeURIComponent(o.taskId!)}`, { headers: op.headers, signal: op.signal })));
    } catch { /* Keep the last durable state during a transport interruption. */ }
  }, [scope, capture, id, template]);
  const pollingDelay = snapshot?.turns.some(t => t.status === "running") ? 1500 : snapshot?.outputs.some(o => ["pending", "processing", "generating"].includes(o.status)) ? 3000 : 15000;
  useEffect(() => { let alive = true; let timer: ReturnType<typeof setTimeout>; const run = async () => { await poll(); if (alive) timer = setTimeout(run, pollingDelay); }; void run(); return () => { alive = false; clearTimeout(timer); }; }, [poll, pollingDelay]);
  const latest = snapshot?.turns.at(-1);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [latest?.id, latest?.status]);
  useEffect(() => {
    if (!sourceId || !scope || id) return;
    const op = capture();
    void fetch("/api/creations", { headers: op.headers, signal: op.signal }).then(r => r.json()).then(data => {
      op.assertCurrent(); const source = data.creations?.find((c: { id: string }) => c.id === sourceId);
      if (!source || !["success", "failed"].includes(source.status)) return;
      setSeed({ key: sourceId, prompt: source.status === "failed" ? "Prepare a new quote to retry this image." : "Edit this image: ", sourceGenerationId: source.id, inputs: [...(source.urls[0] ? [{ url: source.urls[0], kind: "image" as const, role: "edit" as const }] : []), ...source.inputUrls.filter((u: string) => u !== source.urls[0]).map((url: string) => ({ url, kind: "image" as const, role: "reference" as const }))] });
    }).catch(() => undefined);
  }, [sourceId, scope, capture, id]);
  const action = async (name: string, extra: object = {}) => {
    if (!scope || !id || busy) return;
    if (name === "retry_media") {
      const gid = (extra as { generationId: string }).generationId;
      if (!retryIds.current.has(gid)) retryIds.current.set(gid, crypto.randomUUID());
      extra = { ...extra, retryId: retryIds.current.get(gid) };
    }
    setBusy(true); setError(""); const op = capture();
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { ...op.headers, "Content-Type": "application/json" }, signal: op.signal, body: JSON.stringify({ action: name, conversationId: id, ...extra }) });
      const data = await res.json(); op.assertCurrent();
      if (!res.ok) { if (data.code === "insufficient_credits") trackEvent("insufficient_credits_shown", { source: "agent" }); throw new Error(data.error); }
      if (name === "confirm" && !data.replay) {
        const turn = snapshot?.turns.find(t => t.id === (extra as { turnId: string }).turnId);
        data.generationIds.forEach((gid: string) => observed.current.add(gid));
        trackEvent("generation_started", { source: "agent", type: turn?.quote?.type, model: turn?.quote?.model, template_id: template?.id, output_count: turn?.quote?.count, credits_cost: turn?.quote?.credits });
      }
      if (name === "retry_media") retryIds.current.delete((extra as { generationId: string }).generationId);
      if (name === "delete") router.push("/agent");
      setEditingTitle(null); setDeleting(false);
      window.dispatchEvent(new Event("agent-conversations-changed")); await poll();
    } catch (e) { if (!op.signal.aborted) setError(e instanceof Error ? e.message : "Request failed."); }
    finally { setBusy(false); }
  };
  const repriceQuote = async (turnId: string, quote: AgentQuote) => {
    if (!scope || !id) throw new Error("Sign in to update this quote.");
    const op = capture();
    const res = await fetch("/api/agent", { method: "POST", headers: { ...op.headers, "Content-Type": "application/json" }, signal: op.signal,
      body: JSON.stringify({ action: "reprice", conversationId: id, turnId, quote }) });
    const data = await res.json(); op.assertCurrent();
    if (!res.ok) throw new Error(data.error || "Could not update this quote.");
    void poll();
    return data.quote as AgentQuote;
  };
  const referenceOutput = (output: AgentOutput) => {
    if (!output.urls[0] || (output.type !== "image" && output.type !== "video")) return;
    setSeed({ key: crypto.randomUUID(), prompt: "", inputs: [{ url: output.urls[0], kind: output.type, role: "reference" }] });
  };
  const download = (output: AgentOutput) => {
    trackEvent("result_download_clicked", { type: output.type, source: "agent", template_id: template?.id });
    const link = document.createElement("a"); link.href = buildCreationDownloadPath(output.id, output.urls[0]); link.download = ""; document.body.appendChild(link); link.click(); link.remove();
  };
  const deleteOutput = async () => {
    if (!scope || !pendingOutputDelete || busy) return;
    setBusy(true); setError(""); const op = capture();
    try {
      const response = await fetch("/api/creations", { method: "PATCH", headers: { ...op.headers, "Content-Type": "application/json" }, signal: op.signal,
        body: JSON.stringify({ id: pendingOutputDelete.taskId || pendingOutputDelete.id, action: "delete-media", url: pendingOutputDelete.urls[0] }) });
      const data = await response.json(); op.assertCurrent();
      if (!response.ok || !Array.isArray(data.urls)) throw new Error(data.error || "Could not delete this result.");
      setPreview(null); setPendingOutputDelete(null); await poll();
    } catch (e) { if (!op.signal.aborted) setError(e instanceof Error ? e.message : "Could not delete this result."); }
    finally { setBusy(false); }
  };
  const retryReply = async (turn: AgentTurnView) => {
    if (!scope || busy) return;
    setBusy(true); const op = capture();
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { ...op.headers, "Content-Type": "application/json" }, signal: op.signal,
        body: JSON.stringify({ action: "message", conversationId: id, id: turn.id, prompt: turn.prompt, inputs: turn.inputs, templateId: template?.id, revision: snapshot?.conversation?.revision }) });
      const data = await res.json(); op.assertCurrent(); if (!res.ok) throw new Error(data.error); await poll();
    } catch (e) { if (!op.signal.aborted) setError(e instanceof Error ? e.message : "Retry failed."); } finally { setBusy(false); }
  };
  return <div className="flex h-dvh overflow-hidden bg-background">
    <WorkspaceSidebar activeSection="agent" collapsed={collapsed} onCollapsedChange={setCollapsed} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
    <div className="flex min-w-0 flex-1 flex-col">
      <WorkspaceMobileHeader onOpen={() => setMobileOpen(true)} />
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-4 sm:px-6">
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{snapshot?.conversation?.title ?? (template ? `${template.title} · Agent` : "Agent")}</h1>
        {id && snapshot?.conversation && <><Button variant="ghost" aria-label="Rename conversation" onClick={() => setEditingTitle(snapshot.conversation!.title)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" aria-label="Delete conversation" onClick={() => setDeleting(true)}><Trash2 className="h-4 w-4" /></Button></>}
      </header>
      <main data-settings-boundary className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-8">
          {!id && <div className="py-10 text-center"><h2 className="font-display text-3xl font-medium">{template ? `Let's create your ${template.title.toLowerCase()}` : "What would you like to create?"}</h2><p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">{template ? template.rules.objective : "Explore an idea, create images or make a video. Describe your goal and add any references. You review the credits before generating."}</p>{template && <><p className="mt-3 text-xs text-muted-foreground">{template.reference === "required" ? "Upload a clear reference photo to get started." : "Reference photos and brand assets are optional."}</p><p className="mt-3 text-sm text-muted-foreground">Example: {template.id === "headshot" ? "Create a clean professional portrait for my profile." : `Create a minimalist ${template.title.toLowerCase()} for a coffee brand, using cream and green.`}</p></>}</div>}
          {!id && template && !sourceId && <LegacyAgentDraft templateId={template.id} onContinue={setSeed} />}
          {id && !snapshot && status === "authenticated" && !error && <p role="status" className="text-sm text-muted-foreground">Loading conversation…</p>}
          {id && status === "unauthenticated" && <Button onClick={() => void signInForCurrentEnvironment()}>Sign in to open this conversation</Button>}
          {snapshot?.turns.map(turn => <section key={turn.id} className="space-y-4" aria-label="Conversation turn">
            <div className="ml-auto max-w-xl rounded-ui-xl bg-surface-soft px-4 py-3">{!!turn.inputs.length && <div className="mb-2 flex flex-wrap gap-2">{turn.inputs.map((input, i) => input.kind === "image" ? <img key={i} src={input.url} alt={`Reference ${i + 1}`} className="h-16 w-16 rounded-ui object-cover" /> : <span key={i} className="rounded-ui bg-background px-2 py-1 text-xs text-muted-foreground">{input.kind} reference</span>)}</div>}<p className="whitespace-pre-wrap break-words text-sm">{turn.prompt}</p></div>
            {turn.response && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{turn.response}</p>}
            {turn.status === "running" && <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Preparing your reply…</div>}
            {turn.error && <div className="space-y-2"><p className="text-sm text-destructive">{turn.error}</p>{turn.id === latest?.id && <Button variant="outline" disabled={busy} onClick={() => void retryReply(turn)}>Retry reply</Button>}</div>}
            {turn.id === latest?.id && turn.suggestions.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Quick answers">{turn.suggestions.map(answer => <Button key={answer} variant="outline" disabled={busy || latest.status === "running"} onClick={() => setSeed({ key: crypto.randomUUID(), prompt: answer, inputs: turn.inputs, autoSend: true })}>{answer}</Button>)}</div>}
            {turn.quote && <QuoteCard turn={turn} current={turn.revision === snapshot.conversation?.revision} busy={busy} onConfirm={() => void action("confirm", { turnId: turn.id })} onReprice={repriceQuote} />}
            {!!turn.generationIds.length && <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{snapshot.outputs.filter(o => turn.generationIds.includes(o.id)).map(output => <AgentResultCard key={output.id} output={output} prompt={turn.prompt} busy={busy} onPreview={() => setPreview(output)} onReference={() => referenceOutput(output)} onDownload={() => download(output)} onDelete={() => setPendingOutputDelete(output)} onRetry={() => void action("retry_media", { generationId: output.id })} />)}</div>}
          </section>)}
          <div ref={bottom} />
        </div>
      </main>
      <div className="relative z-0 shrink-0 px-3 pb-3 sm:px-6 sm:pb-5"><div className="mx-auto max-w-3xl space-y-2">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {cleanupPending && <Button variant="outline" disabled={busy} onClick={() => void action("delete")}>Retry attachment cleanup</Button>}
        <div className="rounded-ui-xl border border-border bg-background p-2.5 shadow-soft sm:p-3"><AgentComposer key={id ? (snapshot ? "ready" : "loading") : "new"} initialInputs={latest?.inputs} conversationId={id} revision={snapshot?.conversation?.revision ?? 0} templateId={template?.id} seed={seed} disabled={latest?.status === "running" || (!!id && !snapshot)} onSent={() => void poll()} /></div>
      </div></div>
    </div>
    {editingTitle !== null && <Modal onClose={() => setEditingTitle(null)} aria-label="Rename conversation" className="flex items-center justify-center bg-surface-dark/30 p-4"><div className="w-full max-w-sm space-y-4 rounded-ui-xl bg-background p-5"><label className="block text-sm" htmlFor="conversation-title">Conversation title</label><input id="conversation-title" value={editingTitle} maxLength={100} onChange={e => setEditingTitle(e.target.value)} className="h-11 w-full rounded-ui border border-border bg-background px-3 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary" /><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditingTitle(null)}>Cancel</Button><Button disabled={busy || !editingTitle.trim()} onClick={() => void action("rename", { title: editingTitle })}>Save</Button></div></div></Modal>}
    {deleting && <Modal onClose={() => setDeleting(false)} aria-label="Delete conversation" className="flex items-center justify-center bg-surface-dark/30 p-4"><div className="w-full max-w-sm space-y-4 rounded-ui-xl bg-background p-5"><p className="text-sm">Delete this conversation? Generated work stays in Assets. Wait for any generation or refund to finish first.</p><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDeleting(false)}>Cancel</Button><Button disabled={busy} onClick={() => void action("delete")}>Delete conversation</Button></div></div></Modal>}
    {pendingOutputDelete && <Modal onClose={() => setPendingOutputDelete(null)} aria-label="Delete generated result" className="flex items-center justify-center bg-surface-dark/30 p-4"><div className="w-full max-w-sm space-y-4 rounded-ui-xl bg-background p-5"><p className="text-sm">Delete this generated result? This also removes it from Assets.</p><div className="flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setPendingOutputDelete(null)}>Cancel</Button><Button disabled={busy} onClick={() => void deleteOutput()}>Delete result</Button></div></div></Modal>}
    {preview && <MediaPreviewModal creationId={preview.id} url={preview.urls[0]} type={preview.type === "video" ? "video" : "image"} alt="Generated media preview" onClose={() => setPreview(null)} />}
  </div>;
}
function AgentResultCard({ output, prompt, busy, onPreview, onReference, onDownload, onDelete, onRetry }: {
  output: AgentOutput; prompt: string; busy: boolean; onPreview: () => void; onDownload: () => void; onDelete: () => void;
  onReference: () => void; onRetry: () => void;
}) {
  const url = output.urls[0];
  const audioDisabled = String(output.parameters.audio ?? output.parameters.sound ?? "").toLowerCase() === "off";
  if (!url) return <div className="flex min-h-44 items-center justify-center rounded-ui-lg bg-surface-soft p-4 text-sm" role="status">{output.status === "failed" ? "Generation failed" : output.status === "deleted" ? "Result deleted" : <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Generating {output.type}…</>}</div>;
  return <div className={`group/result relative min-w-0 space-y-2 ${output.type === "video" ? "w-full max-w-lg" : "w-fit max-w-full"}`}>
    {output.status === "success" && <ResultOverlayActions showReference={["image", "video"].includes(output.type)} onReference={onReference} onDownload={onDownload} onDelete={onDelete} />}
    {output.type === "image" ? <ResilientMedia creationId={output.id} url={url} label="Generated image" className="max-w-lg rounded-ui-lg">{({ src, onError, onReady }) => <button type="button" onClick={onPreview} className="inline-flex max-w-full overflow-hidden rounded-ui-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Preview generated image"><img src={src} onError={onError} onLoad={onReady} alt="Generated image" className="h-auto max-h-[30rem] max-w-full w-auto object-contain" /></button>}</ResilientMedia> : <VideoResult creationId={output.id} url={url} prompt={prompt} audioDisabled={audioDisabled} onOpen={onPreview} />}
    {output.error && <p className="text-xs text-destructive">{output.error}</p>}
    {output.status === "failed" && <p className="text-xs text-muted-foreground">{output.parameters.creditOutcome === "pending" ? "Refund is being processed. Please wait before retrying." : "Credit settlement completed. Review a new quote to retry."}</p>}
    {output.status === "failed" && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={onRetry}>Review retry cost</Button></div>}
  </div>;
}

function QuoteCard({ turn, current, busy, onConfirm, onReprice }: { turn: AgentTurnView; current: boolean; busy: boolean; onConfirm: () => void; onReprice: (turnId: string, quote: AgentQuote) => Promise<AgentQuote> }) {
  const ref = useRef<HTMLDivElement>(null), seen = useRef(false);
  const q = turn.quote!;
  const [draft, setDraft] = useState(q);
  const [repricing, setRepricing] = useState(false), [editError, setEditError] = useState("");
  useEffect(() => { setDraft(q); }, [q, turn.id]);
  const submitted = turn.generationIds.length > 0;
  const compact = submitted || !current;
  const updateQuote = async (next: AgentQuote) => {
    if (repricing || busy) return;
    setDraft(next); setRepricing(true); setEditError("");
    try { setDraft(await onReprice(turn.id, next)); }
    catch (error) { setDraft(q); setEditError(error instanceof Error ? error.message : "Could not update this quote."); }
    finally { setRepricing(false); }
  };
  const imageModel = draft.type === "image" ? IMAGE_MODEL_OPTION_MAP[draft.modelId as keyof typeof IMAGE_MODEL_OPTION_MAP] : null;
  const imageReferences = draft.inputs.filter(input => input.kind === "image").length;
  const imageResolutions = imageModel ? imageModel.flatCredits ? [] : (imageModel.resolutions ?? Object.keys(imageModel.credits)) : [];
  const imageRatios = imageModel ? getImageAspectRatios(imageModel.id, draft.resolution as never, imageReferences) : [];
  const videoModels = [...new Map(VIDEO_MODEL_OPTIONS.map(option => [getVideoModelName(option), { id: getVideoModelName(option), label: getVideoModelName(option) }])).values()];
  const videoOptions = draft.type === "video" ? VIDEO_MODEL_OPTIONS.filter(option => getVideoModelName(option) === draft.model) : [];
  const videoResolutions = [...new Set(videoOptions.map(option => option.resolution))];
  const videoAtResolution = videoOptions.filter(option => option.resolution === draft.resolution);
  const videoRatios = [...new Set(videoAtResolution.flatMap(option => option.aspectRatios ?? []))];
  const videoDurations = [...new Set(videoAtResolution.map(option => option.duration))].sort((a, b) => a - b);
  useEffect(() => {
    if (!ref.current || !current || submitted) return;
    const observer = new IntersectionObserver(entries => { if (seen.current || !entries.some(e => e.isIntersecting && e.intersectionRatio >= .5)) return; seen.current = true; const key = `agent-quote:${turn.id}`; try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* Local fallback. */ } trackEvent("agent_quote_viewed", { type: q.type, model: q.model, template_id: q.templateId, credits_cost: q.credits }); }, { threshold: .5 });
    observer.observe(ref.current); return () => observer.disconnect();
  }, [current, turn.id, submitted, q]);
  return <div ref={ref} className={compact ? "" : "space-y-4"}>
    {compact ? <p className="whitespace-pre-wrap text-sm">{q.prompt}</p> : <>
      <textarea aria-label="Optimized prompt" value={draft.prompt} disabled={repricing || busy} onChange={event => setDraft(current => ({ ...current, prompt: event.target.value }))} onBlur={() => { if (draft.prompt.trim() && draft.prompt !== q.prompt) void updateQuote({ ...draft, prompt: draft.prompt.trim() }); }} className="min-h-24 w-full resize-y rounded-ui-xl bg-surface-soft px-4 py-3 text-sm leading-relaxed transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
      <div className="flex min-w-0 items-center gap-2"><GenerationSettings models={draft.type === "image" ? IMAGE_MODEL_OPTIONS.map(model => ({ id: model.id, label: model.label })) : videoModels} model={draft.type === "image" ? draft.modelId : draft.model} onModel={value => {
        if (draft.type === "image") { const model = IMAGE_MODEL_OPTION_MAP[value as keyof typeof IMAGE_MODEL_OPTION_MAP]; const resolution = model.flatCredits ? "Auto" : (model.resolutions ?? Object.keys(model.credits))[0]; void updateQuote({ ...draft, model: value, modelId: value, resolution, aspectRatio: getImageAspectRatios(value as never, resolution as never, imageReferences)[0] ?? "1:1" }); return; }
        const option = VIDEO_MODEL_OPTIONS.find(item => getVideoModelName(item) === value)!; void updateQuote({ ...draft, model: value, resolution: option.resolution, duration: option.duration, aspectRatio: (option.aspectRatios ?? ["Auto"])[0], sound: !!option.hasAudio });
      }} ratios={draft.type === "image" ? imageRatios : videoRatios} ratio={draft.aspectRatio} onRatio={value => void updateQuote({ ...draft, aspectRatio: value })} resolutions={draft.type === "image" ? imageResolutions : videoResolutions} resolution={draft.resolution} onResolution={value => {
        if (draft.type === "image") { const ratio = getImageAspectRatios(draft.modelId as never, value as never, imageReferences).includes(draft.aspectRatio) ? draft.aspectRatio : getImageAspectRatios(draft.modelId as never, value as never, imageReferences)[0]; void updateQuote({ ...draft, resolution: value, aspectRatio: ratio }); return; }
        const option = videoOptions.find(item => item.resolution === value)!; void updateQuote({ ...draft, resolution: value, duration: option.duration, aspectRatio: (option.aspectRatios ?? ["Auto"])[0], sound: !!option.hasAudio });
      }} count={draft.type === "image" ? draft.count : undefined} onCount={draft.type === "image" ? value => void updateQuote({ ...draft, count: value }) : undefined} durations={draft.type === "video" ? videoDurations : undefined} duration={draft.type === "video" ? draft.duration : undefined} onDuration={draft.type === "video" ? value => void updateQuote({ ...draft, duration: value }) : undefined} placement="auto" /><Button className="shrink-0 gap-2" disabled={busy || repricing || draft.prompt !== q.prompt || !current} onClick={onConfirm}><span>{draft.credits} credits</span><Send className="h-4 w-4" /></Button></div>
      {editError && <p role="alert" className="text-xs text-destructive">{editError}</p>}
    </>}
  </div>;
}
