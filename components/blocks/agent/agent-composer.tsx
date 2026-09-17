"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowUp, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAccountOperation } from "@/lib/use-account-operation";
import { ReferencePicker } from "@/components/blocks/reference-picker";
import { CreationModeSelector } from "@/components/blocks/composer-input-controls";
import { AGENT_INPUT_CAPABILITIES } from "@/lib/reference-validation";
import { getAccountScope } from "@/lib/account-scope";
import { signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import { trackEvent } from "@/lib/analytics";
import type { AgentInput } from "@/lib/agent/contract";


export type AgentDraft = { prompt: string; inputs: AgentInput[]; sourceGenerationId?: string; pendingRequestId?: string };
type AgentComposerSeed = AgentDraft & { key: string; autoSend?: boolean };
export function AgentComposer({ conversationId, revision = 0, templateId, disabled = false, initialInputs = [], seed, onSent, onModeChange }: {
  conversationId?: string; revision?: number; templateId?: string; disabled?: boolean;
  initialInputs?: AgentInput[]; seed?: AgentComposerSeed; onSent?: () => void; onModeChange?: (mode: "image" | "video") => void;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const scope = getAccountScope(session?.user);
  const { capture } = useAccountOperation();
  const [draft, setDraft] = useState<AgentDraft>({ prompt: "", inputs: [] });
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [uploadsPending, setUploadsPending] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null), lock = useRef(false);
  const requestId = useRef("");
  const autoSentSeed = useRef("");
  const sendRef = useRef<(value?: AgentDraft) => Promise<void>>(async () => undefined);
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
  useEffect(() => {
    if (!seed) return;
    const { key, autoSend, ...seedDraft } = seed;
    setDraft(seedDraft);
    requestId.current = "";
    textarea.current?.focus();
    if (autoSend && autoSentSeed.current !== key) {
      autoSentSeed.current = key;
      void sendRef.current(seedDraft);
    }
  }, [seed]);
  const update = (value: Partial<AgentDraft>) => { requestId.current = ""; setDraft(current => ({ ...current, ...value, pendingRequestId: undefined })); };
  const login = (value = draft) => {
    try { sessionStorage.setItem(loginKey, JSON.stringify(value)); } catch { /* Optional login recovery. */ }
    trackEvent("signup_started", { source: "agent" });
    void signInForCurrentEnvironment();
  };
  const send = async (value = draft) => {
    if ((!value.prompt.trim() && !value.inputs.length) || lock.current || disabled || uploadsPending) return;
    if (!scope) { login(value); return; }
    lock.current = true; setBusy(true); setError("");
    const op = capture();
    try {
      if (!requestId.current) requestId.current = value.pendingRequestId ?? crypto.randomUUID();
      const pendingDraft = { ...value, pendingRequestId: requestId.current };
      setDraft(pendingDraft);
      try { sessionStorage.setItem(storageKey, JSON.stringify(pendingDraft)); } catch { /* In-memory idempotency still applies. */ }
      const id = conversationId ?? requestId.current;
      const response = await fetch("/api/agent", { method: "POST", headers: { ...op.headers, "Content-Type": "application/json" }, signal: op.signal,
        body: JSON.stringify({ action: "message", conversationId: id, id: requestId.current, revision, templateId, ...value }) });
      const data = await response.json(); op.assertCurrent();
      if (response.status === 401) { login(value); return; }
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
      setDraft({ prompt: "", inputs: [] });
      try { sessionStorage.removeItem(storageKey); } catch { /* Optional storage. */ }
      window.dispatchEvent(new Event("agent-conversations-changed"));
      if (!conversationId) router.push(`/agent/${data.conversationId}`);
      onSent?.();
    } catch (e) { if (!op.signal.aborted) setError(e instanceof Error ? e.message : "Could not send this message."); }
    finally { lock.current = false; setBusy(false); }
  };
  sendRef.current = send;
  return <div className="mt-2 space-y-2">
    {!!draft.inputs.length && <div className="flex flex-wrap gap-2">{draft.inputs.map((ref, i) => <div key={`${ref.url}-${i}`} className="relative h-20 w-20 overflow-hidden rounded-ui border border-border bg-surface-soft">
      {ref.kind === "image" ? <img src={ref.url} alt={`Reference ${i + 1}`} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center px-2 text-center text-xs">{ref.kind} reference</span>}
      <button type="button" disabled={busy} aria-label={`Remove reference ${i + 1}`} onClick={() => update({ inputs: draft.inputs.filter((_, n) => n !== i), sourceGenerationId: undefined })} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 transition-all duration-300 hover:bg-surface-strong focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"><X className="h-4 w-4" /></button>
    </div>)}</div>}
    <Textarea ref={textarea} id="agent-message" aria-label="Message Agent" value={draft.prompt} onChange={e => update({ prompt: e.target.value })} maxLength={5000} disabled={busy} placeholder="Describe what you want to create…" className="h-20 min-h-20 resize-none border-0 bg-transparent px-1 py-1 shadow-none focus-visible:ring-0" onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(draft); } }} />
    {draft.inputs.some(i => i.kind !== "image") && <p className="text-xs text-muted-foreground">Video and audio are generation references. Describe what to preserve or change.</p>}
    {uploadsPending && <p role="status" className="text-xs text-muted-foreground">Finish uploading or remove failed files in the + menu before sending.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex min-h-12 items-start gap-1 border-t border-border pt-2">
      <ReferencePicker capabilities={AGENT_INPUT_CAPABILITIES} attachments={draft.inputs.map((ref, i) => ({ ...ref, id: `${ref.url}-${i}`, name: ref.name ?? `Reference ${i + 1}`, source: "reference" }))} disabled={busy || disabled} onBusyChange={setUploadsPending} onLogin={login} menuPlacement="above" onAdd={items => { requestId.current = ""; setDraft(current => ({ ...current, pendingRequestId: undefined, inputs: [...current.inputs, ...items.map(item => ({ url: item.url, kind: item.kind, role: "reference" as const, name: item.name, contentType: item.contentType, sizeBytes: item.sizeBytes, durationSeconds: item.durationSeconds }))] })); }} />
      <CreationModeSelector value="agent" disabled={busy || uploadsPending} menuPlacement="above" onChange={mode => { if (mode === "agent") return; if (onModeChange) onModeChange(mode); else router.push(`/${mode}`); }} />
      <Button className="ml-auto" disabled={!loaded || busy || uploadsPending || disabled || status === "loading" || (!draft.prompt.trim() && !draft.inputs.length)} onClick={() => void send(draft)} aria-label={scope ? "Send message" : "Sign in to send"}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</Button>
    </div>
  </div>;
}
