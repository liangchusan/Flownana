"use client";

import { useEffect, useRef, useState } from "react";
import { X, Upload, Loader2, ArrowLeft } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAccountOperation } from "@/lib/use-account-operation";
import { uploadAccountMedia } from "@/lib/account-media-upload";
import { signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import { getImageTemplate, TEMPLATE_MODEL } from "@/lib/image-templates/catalog";
import { type TemplateAnalysis, type TemplateInput, MAX_BRIEF_LENGTH } from "@/lib/image-templates/contract";
import { getImageGenerationCredits, type ImageResolutionKey } from "@/lib/generation-pricing";
import { getImageAspectRatios } from "@/lib/image-model-capabilities";
import { getImageInputCapabilities } from "@/lib/generation-input-capabilities";
import { trackEvent } from "@/lib/analytics";
import type { CreationHistoryItem } from "@/lib/creation-history";

type Run = { id: string; revision: number; status: string; input: TemplateInput; analysis: TemplateAnalysis | null; generationIds: string[]; error?: string };
type Draft = { id: string; revision: number; input: TemplateInput; run: Run | null };
export const TEMPLATE_OPEN_KEY = "flownana:template-open";

export function TemplatePanel({ templateId, editing, onClose, onAccepted }: {
  templateId: string; editing?: CreationHistoryItem; onClose: () => void; onAccepted: (ids: string[]) => void;
}) {
  const template = getImageTemplate(templateId);
  const isRetry = editing?.status === "failed";
  const { accountScope, capture } = useAccountOperation();
  const key = `flownana:template:v1:${accountScope || "anonymous"}:${templateId}:${editing?.id || "new"}`;
  const [draft, setDraft] = useState<Draft>(() => ({ id: "", revision: 0, run: null, input: {
    templateId, prompt: "", answers: {}, images: editing ? [...new Set([...editing.urls.slice(0, 1), ...editing.inputUrls])].slice(0, 16) : [],
    ...(editing && !isRetry ? { parentGenerationId: editing.id } : {}),
  } }));
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [count, setCount] = useState(editing ? 1 : 4);
  const [resolution, setResolution] = useState<ImageResolutionKey>("1K");
  const [ratio, setRatio] = useState("1:1");
  const uploadRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const ready = draft.run?.status === "ready" && draft.run.analysis?.status === "ready" ? draft.run.analysis.spec : null;
  const question = draft.run?.analysis?.status === "question" ? template.questions.find((q) => q.id === (draft.run!.analysis as { questionId: string }).questionId) : null;
  const ratios = getImageAspectRatios(TEMPLATE_MODEL, resolution, draft.input.images.length);
  const cost = (getImageGenerationCredits(TEMPLATE_MODEL, resolution, draft.input.images.length) || 0) * count;

  useEffect(() => {
    let restored: Draft | null = null;
    try {
      const resumeKey = `flownana:template-login:${templateId}`;
      const saved = sessionStorage.getItem(key) || (accountScope ? sessionStorage.getItem(resumeKey) : null);
      if (saved) {
        const candidate = JSON.parse(saved);
        if (candidate.input?.templateId === templateId) restored = candidate;
      }
      if (accountScope) sessionStorage.removeItem(resumeKey);
    } catch { /* Draft storage is optional. */ }
    setDraft((current) => restored || { ...current, id: crypto.randomUUID() });
    setLoaded(true);
  }, [key, accountScope, templateId]);
  useEffect(() => {
    if (!loaded) return;
    try { sessionStorage.setItem(key, JSON.stringify(draft)); } catch { /* Keep the live draft if storage is full. */ }
  }, [draft, loaded, key]);

  const acceptRun = (run: Run) => {
    setDraft((current) => ({ ...current, id: run.id, revision: run.revision, input: run.input, run }));
    if (run.analysis?.status === "ready") setCount(run.analysis.spec.outputCount);
    if (run.error) setError(run.error);
  };
  const refresh = async () => {
    if (!accountScope || !draft.id) return;
    const operation = capture();
    const response = await fetch(`/api/image-template?id=${encodeURIComponent(draft.id)}`, { headers: operation.headers, signal: operation.signal, cache: "no-store" });
    const data = await response.json(); operation.assertCurrent();
    if (response.ok && data.accountScope === accountScope) acceptRun(data.run);
  };
  // Resume an interrupted request from server state without resubmitting paid work.
  useEffect(() => {
    if (!loaded || !accountScope || !draft.id) return;
    let alive = true;
    const timer = draft.run?.status === "analyzing" ? setInterval(() => { if (alive && !busyRef.current) void refresh().catch(() => {}); }, 5000) : undefined;
    if (draft.run) void refresh().catch(() => {});
    else if (!editing && !draft.input.prompt && !draft.input.images.length) {
      busyRef.current = true; setBusy(true);
      const operation = capture();
      void fetch(`/api/image-template?template=${encodeURIComponent(templateId)}`, { headers: operation.headers, signal: operation.signal, cache: "no-store" }).then(async (response) => { const data = await response.json(); operation.assertCurrent(); if (response.ok && data.accountScope === accountScope && data.run) acceptRun(data.run); }).catch(() => {}).finally(() => { busyRef.current = false; setBusy(false); });
    }
    else if (isRetry && editing) {
      const operation = capture();
      void fetch("/api/image-template", { method: "POST", headers: { ...operation.headers, "Content-Type": "application/json" }, signal: operation.signal, body: JSON.stringify({ action: "retry", id: draft.id, generationId: editing.id }) }).then(async (response) => { const data = await response.json(); operation.assertCurrent(); if (!response.ok || data.accountScope !== accountScope) throw new Error(data.error || "Retry unavailable."); acceptRun(data.run); }).catch((e) => { if (!operation.signal.aborted) setError(e.message); });
    }
    return () => { alive = false; clearInterval(timer); };
    // A draft has one identity; revisions are refreshed without recreating the poller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, accountScope, draft.id, draft.run?.status === "analyzing"]);

  const signIn = () => {
    try { sessionStorage.setItem(`flownana:template-login:${templateId}`, JSON.stringify(draft)); sessionStorage.setItem(TEMPLATE_OPEN_KEY, templateId); } catch { /* Optional storage. */ }
    void signInForCurrentEnvironment();
  };
  const submit = async (action: "analyze" | "generate", input = draft.input) => {
    if (!accountScope) { signIn(); return; }
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    setDraft((current) => ({ ...current, input }));
    const operation = capture();
    try {
      const response = await fetch("/api/image-template", { method: "POST", headers: { ...operation.headers, "Content-Type": "application/json" }, signal: operation.signal,
        body: JSON.stringify({ action, id: draft.id, revision: draft.revision, input, settings: { count, resolution, aspectRatio: ratio, quotedCredits: cost } }) });
      const data = await response.json(); operation.assertCurrent();
      if (!response.ok || data.accountScope !== accountScope) throw new Error(data.error || "Template request failed.");
      acceptRun(data.run);
      if (action === "analyze") {
        trackEvent("template_input_submit", { template_id: templateId, template_version: template.version });
        if (data.run.status === "question" && !Object.keys(input.answers).length) trackEvent("clarification_started", { template_id: templateId });
        if (data.run.status === "ready") trackEvent("clarification_completed", { template_id: templateId, question_count: Object.keys(input.answers).length });
        setAnswer("");
      } else if (data.run.status === "generating") {
        if (!data.replay) trackEvent("generation_started", { type: "image", model: TEMPLATE_MODEL, template_id: templateId, output_count: data.run.generationIds.length, credits_cost: cost });
        onAccepted(data.run.generationIds);
      }
    } catch (e) {
      if (!operation.signal.aborted) { setError(e instanceof Error ? e.message : "Request interrupted. Reopen this draft to check its status before retrying."); void refresh().catch(() => {}); }
    } finally { busyRef.current = false; setBusy(false); }
  };
  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length || busyRef.current) return;
    if (!accountScope) { signIn(); return; }
    const caps = getImageInputCapabilities(TEMPLATE_MODEL);
    if (draft.input.images.length + files.length > caps.maxImages || [...files].some((f) => !f.type.startsWith("image/") || f.size > caps.maxImageBytes)) { setError("Choose supported images within the model's size and count limits."); return; }
    busyRef.current = true; setBusy(true); setError("");
    const operation = capture();
    try {
      const blobs = await Promise.all([...files].map((file) => uploadAccountMedia(file, "image", operation)));
      operation.assertCurrent();
      setDraft((current) => ({ ...current, run: null, input: { ...current.input, images: [...current.input.images, ...blobs.map((blob) => blob.url)], imageRoles: [...(current.input.imageRoles || current.input.images.map(() => "subject")), ...blobs.map(() => "subject")] } }));
    } catch (e) { if (!operation.signal.aborted) setError(e instanceof Error ? e.message : "Upload failed. Try again."); }
    finally { busyRef.current = false; setBusy(false); if (uploadRef.current) uploadRef.current.value = ""; }
  };
  const editBrief = () => { setDraft((current) => ({ ...current, run: null })); setAnswer(""); };

  return <Modal onClose={onClose} aria-label={`${template.title} template`} className="flex items-center justify-center bg-surface-dark/30 p-3 sm:p-6">
    <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-ui-xl border border-border bg-background shadow-float">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="text-lg font-medium">{isRetry ? `Retry ${template.title}` : editing ? `Edit ${template.title}` : template.title}</h2><button type="button" onClick={onClose} aria-label="Close template" className="flex h-11 w-11 items-center justify-center rounded-ui transition-all duration-300 hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-primary"><X className="h-5 w-5" /></button></div>
      <div className="space-y-5 overflow-y-auto p-5">
        {draft.run?.status === "generating" ? <><p>This batch has already been submitted.</p><Button onClick={() => onAccepted(draft.run!.generationIds)}>View results</Button><Button variant="outline" onClick={() => setDraft((current) => ({ ...current, id: crypto.randomUUID(), revision: 0, run: null }))}>Start a new batch</Button></> : <>
        {!ready && !question && <><label className="block text-sm font-medium" htmlFor="template-brief">{editing ? "What would you like to change?" : "Describe your idea"}</label><Textarea id="template-brief" value={draft.input.prompt} maxLength={MAX_BRIEF_LENGTH} disabled={busy} onChange={(e) => setDraft((current) => ({ ...current, input: { ...current.input, prompt: e.target.value } }))} placeholder={editing ? "Keep the chosen direction and describe your changes…" : "Tell us what you want to create. Include any exact wording or details to preserve."} className="min-h-32" />
        {Object.entries(draft.input.answers).map(([id, value]) => <label key={id} className="block space-y-2 text-sm">{template.questions.find((q) => q.id === id)?.title}<Textarea value={value} disabled={busy} onChange={(e) => setDraft((current) => ({ ...current, input: { ...current.input, answers: { ...current.input.answers, [id]: e.target.value } } }))} /></label>)}</>}
        {question && <><button type="button" onClick={editBrief} disabled={busy} className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-all duration-300 hover:text-foreground"><ArrowLeft className="h-4 w-4" />Edit brief and previous answers</button><p className="text-xs text-muted-foreground">Question {Math.min(Object.keys(draft.input.answers).length + 1, template.maxQuestions)} of up to {template.maxQuestions}</p><h3 className="text-lg font-medium">{question.title}</h3>
        {question.options.length > 0 && <div className="grid grid-cols-2 gap-2">{question.options.map((option, optionIndex) => <button type="button" key={option} disabled={busy} onClick={() => setAnswer(question.type === "multi_select" ? (answer.split("; ").includes(option) ? answer.split("; ").filter((item) => item !== option).join("; ") : [...answer.split("; ").filter(Boolean), option].join("; ")) : option)} aria-pressed={question.type === "multi_select" ? answer.split("; ").includes(option) : answer === option} className={`min-h-11 rounded-ui border p-3 text-left text-sm transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary ${answer === option ? "border-primary bg-surface-strong" : "border-border hover:bg-surface-soft"}`}>{question.previews[optionIndex] && <img src={question.previews[optionIndex]} alt="" className="mb-2 w-full rounded-ui" />}{option}</button>)}</div>}
        {question.type !== "image_upload" && <><label htmlFor="template-answer" className="block text-sm">Your answer</label><Textarea id="template-answer" value={answer} maxLength={3000} disabled={busy} onChange={(e) => setAnswer(e.target.value)} placeholder="Choose a direction or describe your own." /></>}
        </>}
        {!ready && <div className="space-y-3"><p className="text-sm font-medium">Reference images · {template.reference}</p><input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => void uploadFiles(e.target.files)} /><Button variant="outline" disabled={busy} onClick={() => accountScope ? uploadRef.current?.click() : signIn()}><Upload className="mr-2 h-4 w-4" />Add images</Button><div className="flex flex-wrap gap-3">{draft.input.images.map((url, index) => <div key={url} className="relative"><img src={url} alt={`Reference ${index + 1}`} className="h-20 w-20 rounded-ui object-cover" /><button type="button" disabled={busy} aria-label={`Remove reference ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, run: null, input: { ...current.input, images: current.input.images.filter((image) => image !== url), imageRoles: (current.input.imageRoles || current.input.images.map(() => "subject")).filter((_, i) => i !== index) } }))} className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-background text-foreground"><X className="h-4 w-4" /></button><label className="mt-1 block text-xs">Role<select disabled={busy} aria-label={`Reference ${index + 1} role`} value={draft.input.imageRoles?.[index] || "subject"} onChange={(e) => setDraft((current) => ({ ...current, input: { ...current.input, imageRoles: current.input.images.map((_, i) => i === index ? e.target.value : current.input.imageRoles?.[i] || "subject") } }))} className="block h-9 w-20 rounded-ui border border-border bg-background">{["subject", "style", "layout", "brand", "edit"].map((role) => <option key={role}>{role}</option>)}</select></label></div>)}</div></div>}
        {ready && <><button type="button" onClick={editBrief} disabled={busy} className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-all duration-300 hover:text-foreground"><ArrowLeft className="h-4 w-4" />Edit brief and references</button><h3 className="text-lg font-medium">Review before generating</h3><p className="whitespace-pre-wrap text-sm leading-relaxed">{ready.summary}</p>{ready.text.length > 0 && <p className="text-sm">Exact text: {ready.text.join(" · ")}</p>}<p className="text-sm text-muted-foreground">GPT-Image-2.5 Sunburst</p><div className="flex flex-wrap gap-2">{draft.input.images.map((url, i) => <img key={url} src={url} alt={`Reference ${i + 1}`} className="h-16 w-16 rounded-ui object-cover" />)}</div><ol className="space-y-2">{(draft.input.parentGenerationId ? Array.from({ length: count }, () => ready.variants[0]) : ready.variants.slice(0, count)).map((variant, i) => <li key={i} className="rounded-ui bg-surface-soft p-3 text-sm"><strong>{i + 1}. {variant.title}</strong><p className="mt-1 text-muted-foreground">{variant.direction}</p></li>)}</ol>
        <div className="grid grid-cols-3 gap-3"><label className="space-y-2 text-sm">Ratio<select disabled={busy} value={ratios.includes(ratio) ? ratio : ratios[0]} onChange={(e) => setRatio(e.target.value)} className="h-11 w-full rounded-ui border border-border bg-background px-2">{ratios.map((r) => <option key={r}>{r}</option>)}</select></label><label className="space-y-2 text-sm">Resolution<select disabled={busy} value={resolution} onChange={(e) => { const res = e.target.value as ImageResolutionKey; setResolution(res); const options = getImageAspectRatios(TEMPLATE_MODEL, res, draft.input.images.length); if (!options.includes(ratio)) setRatio(options[0]); }} className="h-11 w-full rounded-ui border border-border bg-background px-2">{["1K", "2K", "4K"].map((r) => <option key={r}>{r}</option>)}</select></label><label className="space-y-2 text-sm">Images<select disabled={busy} value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-11 w-full rounded-ui border border-border bg-background px-2">{[1,2,3,4].map((n) => <option key={n}>{n}</option>)}</select></label></div><p className="text-sm">Total: <strong>{cost} credits</strong>. Failed outputs follow the existing refund policy.</p></>}
        {error && <p role="alert" className="rounded-ui bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">{question && !question.required && <Button variant="outline" disabled={busy} onClick={() => void submit("analyze", { ...draft.input, answers: { ...draft.input.answers, [question.id]: "Choose a suitable visual style for me; do not invent facts." } })}>Let the system decide</Button>}
        <Button disabled={!loaded || busy || (!ready && !question && !draft.input.prompt.trim() && !draft.input.images.length) || !!(question && question.type !== "image_upload" && !answer.trim()) || !!(question?.type === "image_upload" && !draft.input.images.length)} onClick={() => void submit(ready ? "generate" : "analyze", question ? { ...draft.input, answers: { ...draft.input.answers, [question.id]: question.type === "image_upload" ? "Photo supplied" : answer } } : draft.input)}>{busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Working…</> : ready ? `Generate · ${cost} credits` : accountScope ? "Continue" : "Sign in to continue"}</Button></div>
        </>}
      </div>
    </div>
  </Modal>;
}
