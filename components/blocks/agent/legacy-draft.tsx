"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAccountOperation } from "@/lib/use-account-operation";
import type { AgentDraft } from "./agent-composer";

type SavedDraft = { id: string; input: { templateId: string; prompt: string; images: string[]; answers: Record<string, string>; parentGenerationId?: string }; generationIds?: string[] };
export function LegacyAgentDraft({ templateId, onContinue }: { templateId: string; onContinue: (draft: AgentDraft & { key: string }) => void }) {
  const { accountScope, capture } = useAccountOperation();
  const [saved, setSaved] = useState<SavedDraft | null>(null), [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const valid = (value: SavedDraft | null) => value?.input?.templateId === templateId && !value.generationIds?.length && (value.input.prompt || value.input.images?.length);
    try {
      const raw = sessionStorage.getItem(`flownana:template:v1:${accountScope || "anonymous"}:${templateId}:new`) ?? sessionStorage.getItem(`flownana:template-login:${templateId}`);
      const local = raw ? JSON.parse(raw) : null;
      if (local && !local.run?.generationIds?.length && valid(local)) { setSaved(local); return; }
    } catch { /* Server recovery remains available. */ }
    if (!accountScope) return;
    const op = capture();
    void fetch(`/api/image-template?template=${encodeURIComponent(templateId)}`, { headers: op.headers, signal: op.signal }).then(r => r.ok ? r.json() : null).then(data => { op.assertCurrent(); if (!cancelled && valid(data?.run)) setSaved(data.run); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [accountScope, capture, templateId]);
  if (!saved || dismissed) return null;
  return <div className="space-y-2 rounded-ui border border-border bg-surface-soft p-3 text-sm"><p>You have a saved template draft. Continue it here and review a new quote.</p><div className="flex gap-2"><Button variant="outline" onClick={() => {
    onContinue({ key: saved.id || crypto.randomUUID(), prompt: [saved.input.prompt, ...Object.values(saved.input.answers || {}).filter(v => typeof v === "string")].join("\n"), inputs: (saved.input.images || []).map(url => ({ url, kind: "image", role: "reference" })), sourceGenerationId: saved.input.parentGenerationId });
    setDismissed(true);
  }}>Continue saved draft</Button><Button variant="ghost" onClick={() => setDismissed(true)}>Start fresh</Button></div></div>;
}
