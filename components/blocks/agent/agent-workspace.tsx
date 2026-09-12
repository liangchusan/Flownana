"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Pencil, Trash2, X, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { WorkspaceMobileHeader, WorkspaceSidebar } from "@/components/blocks/workspace-sidebar";
import { LegacyAgentDraft } from "./legacy-draft";
import { ResilientMedia } from "@/components/ui/resilient-media";
import { AgentComposer, type AgentDraft } from "./agent-composer";
import { getAccountScope } from "@/lib/account-scope";
import { useAccountOperation } from "@/lib/use-account-operation";
import { imageTemplates } from "@/lib/image-templates/catalog";
import { trackEvent } from "@/lib/analytics";
import { buildCreationDownloadPath } from "@/lib/creation-download";
import { signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import type { AgentSnapshot, AgentTurnView, AgentOutput } from "./types";

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
  const [preview, setPreview] = useState<AgentOutput | null>(null), [seed, setSeed] = useState<(AgentDraft & { key: string }) | undefined>();
  const observedTurns = useRef(new Set<string>());
  const retryIds = useRef(new Map<string, string>());
  const bottom = useRef<HTMLDivElement>(null), observed = useRef(new Set<string>()), ended = useRef(new Set<string>());
  const template = imageTemplates.find(t => t.id === (snapshot?.conversation?.templateId ?? templateId));
  const poll = useCallback(async () => {
    if (!scope) return;
    const op = capture();
    try {
      const res = await fetch(`/api/agent${id ? `?id=${encodeURIComponent(id)}` : ""}`, { headers: op.headers, signal: op.signal, cache: "no-store" });
      const data = await res.json(); op.assertCurrent();
      if (!res.ok) { setError(data.error); setCleanupPending(data.code === "cleanup_pending"); return; }
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
  const editOutput = (output: AgentOutput, video: boolean) => {
    const parent = snapshot?.turns.find(t => t.generationIds.includes(output.id));
    setSeed({ key: crypto.randomUUID(), prompt: video ? "Use this image to create a video. " : "Edit this image: ", sourceGenerationId: output.id,
      inputs: [{ url: output.urls[0], kind: "image", role: video ? "subject" : "edit" }, ...(parent?.quote?.inputs.filter(i => i.url !== output.urls[0]) ?? [])] });
    if (!video && template) { trackEvent("variant_selected", { template_id: template.id }); trackEvent("continued_edit", { template_id: template.id }); }
  };
  const download = (output: AgentOutput) => {
    trackEvent("result_download_clicked", { type: output.type, source: "agent", template_id: template?.id });
    const link = document.createElement("a"); link.href = buildCreationDownloadPath(output.id, output.urls[0]); link.download = ""; document.body.appendChild(link); link.click(); link.remove();
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
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-8">
          {!id && <div className="py-10 text-center"><h2 className="font-display text-3xl font-medium">{template ? `Let's create your ${template.title.toLowerCase()}` : "What would you like to create?"}</h2><p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">{template ? template.rules.objective : "Explore an idea, create images or make a video. Describe your goal and add any references. You review the credits before generating."}</p>{template && <><p className="mt-3 text-xs text-muted-foreground">{template.reference === "required" ? "Upload a clear reference photo to get started." : "Reference photos and brand assets are optional."}</p><p className="mt-3 text-sm text-muted-foreground">Example: {template.id === "headshot" ? "Create a clean professional portrait for my profile." : `Create a minimalist ${template.title.toLowerCase()} for a coffee brand, using cream and green.`}</p></>}</div>}
          {!id && template && !sourceId && <LegacyAgentDraft templateId={template.id} onContinue={setSeed} />}
          {id && !snapshot && status === "authenticated" && !error && <p role="status" className="text-sm text-muted-foreground">Loading conversation…</p>}
          {id && status === "unauthenticated" && <Button onClick={() => void signInForCurrentEnvironment()}>Sign in to open this conversation</Button>}
          {snapshot?.turns.map(turn => <section key={turn.id} className="space-y-4" aria-label="Conversation turn">
            <div className="ml-auto max-w-xl rounded-ui-xl bg-surface-soft px-4 py-3"><p className="whitespace-pre-wrap break-words text-sm">{turn.prompt}</p>{!!turn.inputs.length && <div className="mt-2 flex flex-wrap gap-2">{turn.inputs.map((input, i) => input.kind === "image" ? <img key={i} src={input.url} alt={`Reference ${i + 1}: ${input.role}`} className="h-16 w-16 rounded-ui object-contain" /> : <span key={i} className="text-xs text-muted-foreground">{input.kind} · {input.role}</span>)}</div>}</div>
            {turn.response && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{turn.response}</p>}
            {turn.status === "running" && <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Preparing your reply…<Button variant="ghost" disabled={busy} onClick={() => void action("stop", { turnId: turn.id })}>Stop reply</Button></div>}
            {turn.error && <div className="space-y-2"><p className="text-sm text-destructive">{turn.error}</p>{turn.id === latest?.id && <Button variant="outline" disabled={busy} onClick={() => void retryReply(turn)}>Retry reply</Button>}</div>}
            {turn.id === latest?.id && turn.suggestions.length > 0 && <div className="flex flex-wrap gap-2">{turn.suggestions.map(answer => <Button key={answer} variant="outline" onClick={() => setSeed({ key: crypto.randomUUID(), prompt: answer, inputs: turn.inputs })}>{answer}</Button>)}</div>}
            {turn.quote && <QuoteCard turn={turn} current={turn.revision === snapshot.conversation?.revision} busy={busy} onConfirm={() => void action("confirm", { turnId: turn.id })} onEdit={() => setSeed({ key: crypto.randomUUID(), prompt: "Update the plan: ", inputs: turn.inputs })} />}
            {!!turn.generationIds.length && <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{snapshot.outputs.filter(o => turn.generationIds.includes(o.id)).map(output => <div key={output.id} className="min-w-0 space-y-2">
              {output.urls[0] ? <ResilientMedia creationId={output.id} url={output.urls[0]} label="Generated result">{({ src, onError, onReady }) => <button type="button" onClick={() => setPreview(output)} className="block w-full overflow-hidden rounded-ui-lg bg-surface-dark transition-all duration-300 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary" aria-label="Preview result">{output.type === "image" ? <img src={src} onError={onError} onLoad={onReady} alt="Generated image" className="aspect-square max-h-96 w-full object-contain" /> : <video src={src} onError={onError} onLoadedData={onReady} muted playsInline preload="metadata" className="aspect-video max-h-96 w-full" />}</button>}</ResilientMedia> : <div className="flex min-h-44 items-center justify-center rounded-ui-lg bg-surface-soft p-4 text-sm" role="status">{output.status === "failed" ? "Generation failed" : output.status === "deleted" ? "Result deleted" : <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Generating {output.type}…</>}</div>}
              {output.error && <p className="text-xs text-destructive">{output.error}</p>}{output.status === "failed" && <p className="text-xs text-muted-foreground">{output.parameters.creditOutcome === "pending" ? "Refund is being processed. Please wait before retrying." : "Credit settlement completed. Review a new quote to retry."}</p>}
              <div className="flex flex-wrap gap-2">{output.status === "success" && <><Button variant="ghost" onClick={() => download(output)} aria-label="Download result"><Download className="h-4 w-4" /></Button>{output.type === "image" && <><Button variant="outline" onClick={() => editOutput(output, false)}>Edit image</Button><Button variant="outline" onClick={() => editOutput(output, true)}>Make video</Button></>}</>}
              {output.status === "failed" && <Button variant="outline" disabled={busy} onClick={() => void action("retry_media", { generationId: output.id })}>Review retry cost</Button>}</div>
            </div>)}</div>}
          </section>)}
          <div ref={bottom} />
        </div>
      </main>
      <div className="shrink-0 px-3 pb-3 sm:px-6 sm:pb-5"><div className="mx-auto max-w-3xl space-y-2">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {cleanupPending && <Button variant="outline" disabled={busy} onClick={() => void action("delete")}>Retry attachment cleanup</Button>}
        <div className="rounded-ui-xl border border-border bg-background p-3 shadow-soft"><AgentComposer key={id ? (snapshot ? "ready" : "loading") : "new"} initialInputs={latest?.inputs} conversationId={id} revision={snapshot?.conversation?.revision ?? 0} templateId={template?.id} seed={seed} disabled={latest?.status === "running" || (!!id && !snapshot)} onSent={() => void poll()} /></div>
        {snapshot?.usage && <p className="text-center text-xs text-muted-foreground">{Math.max(0, snapshot.usage.limit - snapshot.usage.used)} of {snapshot.usage.limit} replies left · Resets {new Date(snapshot.usage.resetAt).toLocaleString()} · Media uses credits</p>}
      </div></div>
    </div>
    {editingTitle !== null && <Modal onClose={() => setEditingTitle(null)} aria-label="Rename conversation" className="flex items-center justify-center bg-surface-dark/30 p-4"><div className="w-full max-w-sm space-y-4 rounded-ui-xl bg-background p-5"><label className="block text-sm" htmlFor="conversation-title">Conversation title</label><input id="conversation-title" value={editingTitle} maxLength={100} onChange={e => setEditingTitle(e.target.value)} className="h-11 w-full rounded-ui border border-border bg-background px-3 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary" /><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditingTitle(null)}>Cancel</Button><Button disabled={busy || !editingTitle.trim()} onClick={() => void action("rename", { title: editingTitle })}>Save</Button></div></div></Modal>}
    {deleting && <Modal onClose={() => setDeleting(false)} aria-label="Delete conversation" className="flex items-center justify-center bg-surface-dark/30 p-4"><div className="w-full max-w-sm space-y-4 rounded-ui-xl bg-background p-5"><p className="text-sm">Delete this conversation? Generated work stays in Assets. Wait for any generation or refund to finish first.</p><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDeleting(false)}>Cancel</Button><Button disabled={busy} onClick={() => void action("delete")}>Delete conversation</Button></div></div></Modal>}
    {preview && <Modal onClose={() => setPreview(null)} aria-label="Result preview" className="flex items-center justify-center bg-surface-dark/90 p-4"><div className="relative w-full max-w-5xl"><Button variant="outline" className="absolute right-0 top-0 z-10" aria-label="Close preview" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button>{preview.type === "image" ? <img src={preview.urls[0]} alt="Generated image preview" className="max-h-[85dvh] w-full object-contain" /> : <video src={preview.urls[0]} controls autoPlay muted playsInline className="max-h-[85dvh] w-full" />}</div></Modal>}
  </div>;
}
function QuoteCard({ turn, current, busy, onConfirm, onEdit }: { turn: AgentTurnView; current: boolean; busy: boolean; onConfirm: () => void; onEdit: () => void }) {
  const ref = useRef<HTMLDivElement>(null), seen = useRef(false);
  const q = turn.quote!;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const expired = !turn.quoteExpiresAt || Date.parse(turn.quoteExpiresAt) <= now;
  useEffect(() => {
    if (!ref.current || !current || expired || turn.generationIds.length) return;
    const observer = new IntersectionObserver(entries => { if (seen.current || !entries.some(e => e.isIntersecting && e.intersectionRatio >= .5)) return; seen.current = true; const key = `agent-quote:${turn.id}`; try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* Local fallback. */ } trackEvent("agent_quote_viewed", { type: q.type, model: q.model, template_id: q.templateId, credits_cost: q.credits }); }, { threshold: .5 });
    observer.observe(ref.current); return () => observer.disconnect();
  }, [current, expired, turn.id, turn.generationIds.length, q]);
  return <div ref={ref} className="space-y-3 rounded-ui-xl border border-border p-4">
    <p className="text-sm font-medium">{turn.generationIds.length ? "Submitted plan" : "Review before generating"}</p>
    <p className="text-xs leading-relaxed text-muted-foreground">{q.model} · {q.resolution} · {q.aspectRatio} · {q.count} {q.type === "image" ? (q.count === 1 ? "image" : "images") : "video"}{q.type === "video" ? ` · ${q.duration}s · Sound ${q.sound ? "On" : "Off"}` : ""}</p>
    {!!q.exactText.length && <p className="whitespace-pre-wrap text-sm">Exact text: {q.exactText.join(" · ")}</p>}
    {!!q.inputs.length && <div className="flex flex-wrap gap-2">{q.inputs.map((input, i) => input.kind === "image" ? <img key={i} src={input.url} alt={`Quoted reference ${i + 1}`} className="h-16 w-16 rounded-ui object-contain" /> : <span key={i} className="text-xs">{input.kind} reference {i + 1}</span>)}</div>}
    {q.directions.map((direction, i) => <p key={i} className="text-sm"><strong>{i + 1}. {direction.title}</strong><span className="mt-1 block text-muted-foreground">{direction.prompt}</span></p>)}
    {!turn.generationIds.length && <div className="flex flex-wrap items-center gap-2"><Button disabled={busy || !current || expired} onClick={onConfirm}>Generate · {q.credits} credits</Button><Button variant="ghost" disabled={busy} onClick={onEdit}>{expired ? "Update expired quote" : "Change requirements"}</Button>{!current && <span className="text-xs text-muted-foreground">Replaced by a newer request</span>}</div>}
  </div>;
}
