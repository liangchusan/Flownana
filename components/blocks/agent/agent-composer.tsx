"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowUp, Plus, X, Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAccountOperation } from "@/lib/use-account-operation";
import { uploadAccountMedia } from "@/lib/account-media-upload";
import { getAccountScope } from "@/lib/account-scope";
import { signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import { trackEvent } from "@/lib/analytics";
import type { AgentInput } from "@/lib/agent/contract";
import type { CreationHistoryItem } from "@/lib/creation-history";

export type AgentDraft = { prompt: string; inputs: AgentInput[]; sourceGenerationId?: string; pendingRequestId?: string };
export function AgentComposer({ conversationId, revision = 0, templateId, disabled = false, initialInputs = [], seed, onSent, onModeChange }: {
  conversationId?: string; revision?: number; templateId?: string; disabled?: boolean;
  initialInputs?: AgentInput[]; seed?: AgentDraft & { key: string }; onSent?: () => void; onModeChange?: (mode: "image" | "video") => void;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const scope = getAccountScope(session?.user);
  const { capture } = useAccountOperation();
  const [draft, setDraft] = useState<AgentDraft>({ prompt: "", inputs: [] });
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [assets, setAssets] = useState<CreationHistoryItem[] | null>(null);
  const input = useRef<HTMLInputElement>(null), textarea = useRef<HTMLTextAreaElement>(null), lock = useRef(false);
  const requestId = useRef("");
  const storageKey = `agent-draft:${scope ?? "anonymous"}:${conversationId ?? templateId ?? "new"}`;
  const loginKey = `agent-login:${conversationId ?? templateId ?? "new"}`;
  useEffect(() => {
    try {
      const value = sessionStorage.getItem(storageKey) ?? (scope ? sessionStorage.getItem(loginKey) : null);
      if (value) setDraft(JSON.parse(value));
      else setDraft({ prompt: "", inputs: initialInputs });
      if (scope) sessionStorage.removeItem(loginKey);
    } catch { /* Live draft remains usable if browser storage is unavailable. */ }
    setLoaded(true);
  }, [storageKey, loginKey, scope]);
  useEffect(() => { if (loaded) try { sessionStorage.setItem(storageKey, JSON.stringify(draft)); } catch { /* Optional draft storage. */ } }, [draft, loaded, storageKey]);
  useEffect(() => { if (seed) { setDraft(seed); requestId.current = ""; textarea.current?.focus(); } }, [seed]);
  const update = (value: Partial<AgentDraft>) => { requestId.current = ""; setDraft(current => ({ ...current, ...value, pendingRequestId: undefined })); };
  const login = () => {
    try { sessionStorage.setItem(loginKey, JSON.stringify(draft)); } catch { /* Optional login recovery. */ }
    trackEvent("signup_started", { source: "agent" });
    void signInForCurrentEnvironment();
  };
  const send = async () => {
    if (!draft.prompt.trim() || lock.current || disabled) return;
    if (!scope) { login(); return; }
    lock.current = true; setBusy(true); setError("");
    const op = capture();
    try {
      if (!requestId.current) requestId.current = draft.pendingRequestId ?? crypto.randomUUID();
      const pendingDraft = { ...draft, pendingRequestId: requestId.current };
      setDraft(pendingDraft);
      try { sessionStorage.setItem(storageKey, JSON.stringify(pendingDraft)); } catch { /* In-memory idempotency still applies. */ }
      const id = conversationId ?? requestId.current;
      const response = await fetch("/api/agent", { method: "POST", headers: { ...op.headers, "Content-Type": "application/json" }, signal: op.signal,
        body: JSON.stringify({ action: "message", conversationId: id, id: requestId.current, revision, templateId, ...draft }) });
      const data = await response.json(); op.assertCurrent();
      if (response.status === 401) { login(); return; }
      if (!response.ok) {
        if (["daily_limit", "rate_limit", "busy", "unavailable"].includes(data.code)) trackEvent("agent_limit_reached", { reason: data.code });
        throw new Error(data.error || "Could not send this message.");
      }
      if (!data.replay) {
        trackEvent("agent_message_submitted", { source: templateId ? "template" : "agent", template_id: templateId });
        if (data.created) trackEvent("agent_conversation_started", { source: templateId ? "template" : "agent", template_id: templateId });
        if (templateId) trackEvent("template_input_submit", { template_id: templateId });
      }
      requestId.current = "";
      setDraft({ prompt: "", inputs: draft.inputs });
      try { sessionStorage.removeItem(storageKey); } catch { /* Optional storage. */ }
      window.dispatchEvent(new Event("agent-conversations-changed"));
      if (!conversationId) router.push(`/agent/${data.conversationId}`);
      onSent?.();
    } catch (e) { if (!op.signal.aborted) setError(e instanceof Error ? e.message : "Could not send this message."); }
    finally { lock.current = false; setBusy(false); }
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length || lock.current) return;
    if (!scope) { login(); return; }
    lock.current = true; setBusy(true); setError("");
    const op = capture();
    try {
      const next = [...draft.inputs];
      for (const file of Array.from(files)) {
        const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : null;
        if (!kind) throw new Error("Choose an image, video or audio file.");
        const max = kind === "image" ? 20 : kind === "video" ? 50 : 15;
        if (file.size > max * 1024 ** 2 || next.length >= 22) throw new Error(`The ${kind} limit is ${max} MB. Keep at most 22 references.`);
        const blob = await uploadAccountMedia(file, kind, op);
        next.push({ url: blob.url, kind, role: "reference" });
        update({ inputs: [...next] });
      }
    } catch (e) { if (!op.signal.aborted) setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { lock.current = false; setBusy(false); if (input.current) input.current.value = ""; }
  };
  const showAssets = async () => {
    if (!scope) { login(); return; }
    if (assets) { setAssets(null); return; }
    const op = capture();
    try { const res = await fetch("/api/creations", { headers: op.headers, signal: op.signal }); const data = await res.json(); op.assertCurrent(); if (!res.ok) throw new Error("Could not load Assets."); setAssets(data.creations.filter((c: CreationHistoryItem) => c.status === "success")); }
    catch (e) { if (!op.signal.aborted) setError(e instanceof Error ? e.message : "Could not load Assets."); }
  };
  return <div className="space-y-3">
    {!!draft.inputs.length && <div className="flex flex-wrap gap-2">{draft.inputs.map((ref, i) => <div key={`${ref.url}-${i}`} className="relative w-28 rounded-ui border border-border p-2">
      {ref.kind === "image" ? <img src={ref.url} alt={`Reference ${i + 1}`} className="h-16 w-full rounded-ui object-contain" /> : <span className="block py-4 text-center text-xs">{ref.kind} reference</span>}
      <button type="button" disabled={busy} aria-label={`Remove reference ${i + 1}`} onClick={() => update({ inputs: draft.inputs.filter((_, n) => n !== i), sourceGenerationId: undefined })} className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-ui bg-background transition-all duration-300 hover:bg-surface-strong focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"><X className="h-4 w-4" /></button>
      <label className="text-xs">Use as<select aria-label={`Reference ${i + 1} role`} value={ref.role} disabled={busy} onChange={e => update({ inputs: draft.inputs.map((r, n) => n === i ? { ...r, role: e.target.value as AgentInput["role"] } : r) })} className="mt-1 h-9 w-full rounded-ui border border-border bg-background text-xs transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary">{["reference", "subject", "style", "layout", "brand", "edit"].map(role => <option key={role}>{role}</option>)}</select></label>
    </div>)}</div>}
    <label htmlFor="agent-message" className="sr-only">Message Agent</label>
    <Textarea ref={textarea} id="agent-message" value={draft.prompt} onChange={e => update({ prompt: e.target.value })} maxLength={5000} disabled={busy} placeholder="Describe what you want to create…" className="min-h-24 resize-y border-0 bg-transparent shadow-none focus-visible:ring-0" onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
    {draft.inputs.some(i => i.kind !== "image") && <p className="text-xs text-muted-foreground">Video and audio are generation references. Describe what to preserve or change.</p>}
    {assets && <div className="max-h-44 overflow-y-auto rounded-ui border border-border p-2"><p className="mb-2 text-xs">Choose from Assets</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{assets.flatMap(c => c.urls.map(url => <button type="button" key={url} disabled={draft.inputs.length >= 22} onClick={() => { update({ inputs: [...draft.inputs, { url, kind: c.type === "music" ? "audio" : c.type, role: "reference" }] }); setAssets(null); }} className="min-h-11 overflow-hidden rounded-ui border border-border p-1 text-xs transition-all duration-300 hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">{c.type === "image" ? <img src={url} alt={c.prompt.slice(0, 60)} className="h-16 w-full object-cover" /> : c.type}</button>))}</div>{!assets.length && <p className="text-xs text-muted-foreground">No saved results yet.</p>}</div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex items-center gap-2">
      <input ref={input} type="file" multiple accept="image/*,video/*,audio/*" hidden onChange={e => void upload(e.target.files)} />
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-primary" disabled={busy} aria-label="Add reference" onClick={() => scope ? input.current?.click() : login()}><Plus className="h-4 w-4" /></Button>
      <Button variant="ghost" disabled={busy} aria-label="Choose from Assets" onClick={() => void showAssets()}><FolderOpen className="h-4 w-4" /></Button>
      <label className="sr-only" htmlFor="agent-mode">Creation mode</label><select id="agent-mode" value="agent" onChange={e => { const mode = e.target.value as "image" | "video"; if (onModeChange) onModeChange(mode); else router.push(`/${mode}`); }} className="h-11 rounded-ui bg-transparent px-2 text-sm transition-all duration-300 hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-primary"><option value="agent">Agent</option><option value="image">Image</option><option value="video">Video</option></select>
      <Button className="ml-auto" disabled={!loaded || busy || disabled || status === "loading" || !draft.prompt.trim()} onClick={() => void send()} aria-label={scope ? "Send message" : "Sign in to send"}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</Button>
    </div>
  </div>;
}
