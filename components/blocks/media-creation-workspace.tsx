"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Music, PanelRightClose, PanelRightOpen, Trash2, Video, X } from "lucide-react";
import { GenerateForm } from "@/components/generate/generate-form";
import { VideoCreationForm } from "@/components/creation/video-creation-form";
import { VoiceCreationForm } from "@/components/creation/voice-creation-form";
import { CreationStream, type WorkspaceRun } from "@/components/blocks/creation-stream";
import { AssetsLibrary } from "@/components/blocks/assets-library";
import { WorkspaceMobileHeader, WorkspaceSidebar, type WorkspaceView } from "@/components/blocks/workspace-sidebar";
import { useToast } from "@/components/blocks/app-toast-provider";
import { creationIdentity, mergeCreations, type CreationHistoryItem, type GenerationParameters } from "@/lib/creation-history";

type ComposerType = CreationHistoryItem["type"];

interface DraftSeed {
  prompt: string;
  attachmentUrl?: string;
  attachmentType?: ComposerType;
  parameters?: GenerationParameters;
  revision: number;
}

function nowIso() {
  return new Date().toISOString();
}

export function MediaCreationWorkspace({
  initialType,
  initialCreations = [],
  initialPrompt,
}: {
  initialType: ComposerType;
  initialCreations?: CreationHistoryItem[];
  initialPrompt?: string;
}) {
  const { showToast } = useToast();
  const [view, setView] = useState<WorkspaceView>("create");
  const [composerType, setComposerType] = useState<ComposerType>(initialType);
  const [creations, setCreations] = useState<CreationHistoryItem[]>(initialCreations);
  const [draft, setDraft] = useState<DraftSeed>({ prompt: initialPrompt || "", revision: 0 });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [detailsRun, setDetailsRun] = useState<WorkspaceRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = scrollRef.current;
    if (!target || view !== "create") return;
    target.scrollTop = target.scrollHeight;
  }, [creations, view]);

  const activeImageCount = creations.filter((creation) => creation.type === "image" && ["pending", "generating", "processing"].includes(creation.status)).length;
  const activeVideoCount = creations.filter((creation) => creation.type === "video" && ["pending", "generating", "processing"].includes(creation.status)).length;
  const activeMusicCount = creations.filter((creation) => creation.type === "music" && ["pending", "generating", "processing"].includes(creation.status)).length;

  const updateCreation = (identity: string, patch: Partial<CreationHistoryItem>) => {
    setCreations((current) => current.map((creation) => creationIdentity(creation) === identity ? { ...creation, ...patch } : creation));
  };

  const resetDraft = () => setDraft((current) => ({ prompt: "", revision: current.revision + 1 }));

  const handleNewCreate = () => {
    setView("create");
    setDetailsRun(null);
    setDetailsOpen(false);
    resetDraft();
  };

  const openDetails = (run: WorkspaceRun) => {
    setDetailsRun(run);
    setDetailsOpen(true);
  };

  const setType = (nextType: ComposerType) => {
    setComposerType(nextType);
    if (draft.attachmentUrl && !isAttachmentCompatible(nextType, draft.attachmentType)) {
      showToast({ title: "Attachment is not compatible", message: "Remove the marked attachment or switch to a compatible generator before creating.", variant: "warning" });
    }
  };

  const restoreCreation = (creation: CreationHistoryItem) => {
    setView("create");
    setComposerType(creation.type);
    setDraft((current) => ({
      prompt: creation.prompt,
      attachmentUrl: creation.inputUrls[0],
      attachmentType: creation.inputUrls[0] ? "image" : undefined,
      parameters: creation.parameters,
      revision: current.revision + 1,
    }));
  };

  const referenceAsset = (creation: CreationHistoryItem, url: string) => {
    setView("create");
    setDraft((current) => ({ ...current, attachmentUrl: url, attachmentType: creation.type, revision: current.revision + 1 }));
    if (!isAttachmentCompatible(composerType, creation.type)) {
      showToast({ title: "Attachment is not compatible", message: "This generator cannot use that media type yet. The attachment is marked and generation is blocked.", variant: "warning" });
    }
  };

  const addOptimisticRun = ({ optimisticId, prompt, parameters, outputCount = 1, type }: { optimisticId: string; prompt: string; parameters: GenerationParameters; outputCount?: number; type: ComposerType }) => {
    const optimistic = Array.from({ length: outputCount }, (_, index): CreationHistoryItem => ({
      id: `${optimisticId}-${index}`,
      type,
      status: "generating",
      urls: [],
      inputUrls: draft.attachmentUrl && draft.attachmentType === "image" ? [draft.attachmentUrl] : [],
      prompt,
      createdAt: nowIso(),
      parameters: { ...parameters, runId: optimisticId, outputIndex: index, outputCount },
    }));
    setCreations((current) => mergeCreations([...current, ...optimistic], []));
  };

  const updateOptimisticOutput = ({ optimisticId, outputIndex = 0, url, taskId, prompt, parameters, inputUrls, status, error, errorCode }: { optimisticId: string; outputIndex?: number; url?: string; taskId?: string; prompt?: string; parameters?: GenerationParameters; inputUrls?: string[]; status: CreationHistoryItem["status"]; error?: string; errorCode?: string }) => {
    setCreations((current) => current.map((creation) => {
      if (creation.parameters?.runId !== optimisticId || (creation.parameters.outputIndex ?? 0) !== outputIndex) return creation;
      const isSettled = status === "success" || status === "failed";
      const processingDurationMs = parameters?.processingDurationMs ?? creation.parameters?.processingDurationMs ?? (isSettled ? Math.max(0, Date.now() - new Date(creation.createdAt).getTime()) : undefined);
      return { ...creation, status, urls: url ? [url] : creation.urls, taskId: taskId || creation.taskId, prompt: prompt || creation.prompt, parameters: { ...creation.parameters, ...parameters, ...(processingDurationMs !== undefined ? { processingDurationMs } : {}), runId: optimisticId, outputIndex }, inputUrls: inputUrls || creation.inputUrls, error, errorCode };
    }));
  };

  const attachmentIncompatible = !!draft.attachmentUrl && !isAttachmentCompatible(composerType, draft.attachmentType);
  const composerKey = `${composerType}-${draft.revision}`;
  const composer = (() => {
    if (composerType === "image") {
      return <GenerateForm key={composerKey} variant="composer" initialPrompt={draft.prompt} initialImage={draft.attachmentType === "image" ? draft.attachmentUrl : undefined} initialParameters={draft.parameters} activeGenerationCount={activeImageCount} isGenerating={activeImageCount >= 5} setIsGenerating={() => undefined} onGenerationStart={(data) => addOptimisticRun({ ...data, type: "image" })} onGenerationTaskCreated={({ optimisticId, taskId, outputIndex }) => updateOptimisticOutput({ optimisticId, outputIndex, taskId, status: "generating" })} onGenerate={(url, taskId, prompt, parameters, optimisticId, inputUrls, outputIndex) => optimisticId && updateOptimisticOutput({ optimisticId, outputIndex, url, taskId, prompt, parameters, inputUrls, status: "success" })} onGenerationFailure={({ optimisticId, taskId, prompt, error, errorCode, outputIndex }) => updateOptimisticOutput({ optimisticId, outputIndex, taskId, prompt, error, errorCode, status: "failed" })} />;
    }
    if (composerType === "video") {
      return <VideoCreationForm key={composerKey} variant="composer" initialPrompt={draft.prompt} initialImage={draft.attachmentType === "image" ? draft.attachmentUrl : undefined} initialParameters={draft.parameters} activeGenerationCount={activeVideoCount} onGenerationStart={(data) => addOptimisticRun({ ...data, type: "video" })} onGenerationTaskCreated={({ optimisticId, taskId, prompt, inputUrls }) => updateOptimisticOutput({ optimisticId, taskId, prompt, inputUrls, status: "generating" })} onGenerate={(url, taskId, prompt, optimisticId, parameters, inputUrls) => optimisticId && updateOptimisticOutput({ optimisticId, url, taskId, prompt, parameters, inputUrls, status: "success" })} onGenerationFailure={({ optimisticId, prompt, error, errorCode }) => updateOptimisticOutput({ optimisticId, prompt, error, errorCode, status: "failed" })} />;
    }
    return <VoiceCreationForm key={composerKey} variant="composer" initialPrompt={draft.prompt} isGenerating={activeMusicCount > 0} setIsGenerating={() => undefined} onGenerationStart={(data) => addOptimisticRun({ ...data, type: "music" })} onGenerate={(url, taskId, prompt, optimisticId) => optimisticId && updateOptimisticOutput({ optimisticId, url, taskId, prompt, status: "success" })} onGenerationFailure={({ optimisticId, prompt, error }) => updateOptimisticOutput({ optimisticId, prompt, error, status: "failed" })} />;
  })();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <WorkspaceSidebar view={view} onViewChange={(nextView) => { setView(nextView); setDetailsRun(null); setDetailsOpen(false); }} onNewCreate={handleNewCreate} collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} mobileOpen={mobileSidebarOpen} onMobileOpenChange={setMobileSidebarOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceMobileHeader onOpen={() => setMobileSidebarOpen(true)} />
        {view === "assets" ? <div className="min-h-0 flex-1 overflow-y-auto"><AssetsLibrary creations={creations} onReference={referenceAsset} onChange={updateCreation} /></div> : (
          <div className="flex min-h-0 flex-1">
            <main className="relative flex min-w-0 flex-1 flex-col">
              {!detailsOpen && (
                  <button
                    type="button"
                    onClick={() => detailsRun && setDetailsOpen(true)}
                    disabled={!detailsRun}
                    className="absolute right-4 top-3 z-20 hidden h-10 w-10 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent lg:flex"
                    aria-label="Open details sidebar"
                    title={detailsRun ? "Open details sidebar" : "Select Details on a result first"}
                  >
                    <PanelRightOpen className="h-5 w-5" />
                  </button>
              )}
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto"><CreationStream creations={creations} onReprompt={restoreCreation} onReference={referenceAsset} onDetails={openDetails} onChange={updateCreation} /></div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-5 sm:pb-5 lg:px-8 lg:pb-6">
                <div className="pointer-events-auto mx-auto w-full max-w-4xl rounded-ui-xl border border-border bg-background/95 p-3 shadow-float backdrop-blur-xl sm:p-4">
                  <div className="mb-3 flex items-center gap-1" role="tablist" aria-label="Generation type">
                    {([
                      ["image", "Image", ImageIcon], ["video", "Video", Video], ["music", "Audio", Music],
                    ] as const).map(([type, label, Icon]) => <button key={type} type="button" onClick={() => setType(type)} className={`flex h-9 items-center gap-1.5 rounded-ui px-3 text-xs font-medium transition-all duration-300 ${composerType === type ? "bg-surface-strong text-foreground" : "text-muted-foreground hover:bg-surface-soft hover:text-foreground"}`}><Icon className="h-4 w-4" />{label}</button>)}
                  </div>
                  {attachmentIncompatible && <div className="mb-3 flex items-center gap-3 rounded-ui-lg border border-destructive/20 bg-destructive/5 px-3 py-2"><Trash2 className="h-4 w-4 text-destructive" /><p className="min-w-0 flex-1 text-xs text-destructive">This {draft.attachmentType === "music" ? "audio" : draft.attachmentType} attachment is incompatible with the selected generator.</p><button type="button" onClick={() => setDraft((current) => ({ ...current, attachmentUrl: undefined, attachmentType: undefined, revision: current.revision + 1 }))} className="text-xs font-medium text-destructive underline underline-offset-2">Remove incompatible</button></div>}
                  <fieldset disabled={attachmentIncompatible} className={attachmentIncompatible ? "opacity-60" : ""}>{composer}</fieldset>
                </div>
              </div>
            </main>
            {detailsRun && detailsOpen && <DetailsPanel run={detailsRun} onClose={() => setDetailsOpen(false)} />}
          </div>
        )}
      </div>
    </div>
  );
}

function isAttachmentCompatible(type: ComposerType, attachmentType?: ComposerType) {
  if (!attachmentType) return true;
  if (type === "music") return false;
  return attachmentType === "image";
}

function DetailsPanel({ run, onClose }: { run: WorkspaceRun; onClose: () => void }) {
  const first = run.creations[0];
  const details: Array<[string, string | number | undefined]> = [
    ["Type", run.type === "music" ? "Audio" : run.type],
    ["Status", run.creations.some((item) => item.status === "failed") ? "Partial / failed" : run.creations.every((item) => item.status === "success") ? "Complete" : "In progress"],
    ["Model", first.parameters?.model], ["Mode", first.parameters?.mode], ["Aspect ratio", first.parameters?.aspectRatio], ["Resolution", first.parameters?.resolution], ["Duration", first.parameters?.duration ? `${first.parameters.duration}s` : undefined], ["Audio", first.parameters?.audio], ["Credits", run.creations.reduce((sum, item) => sum + (item.creditsCost || 0), 0) || undefined],
  ];
  return (
    <aside className="fixed inset-0 z-50 flex flex-col bg-background lg:static lg:z-auto lg:w-80 lg:border-l lg:border-border xl:w-96">
      <div className="flex h-16 items-center justify-between border-b border-border px-5"><div><h2 className="text-sm font-medium text-foreground">Generation details</h2><p className="text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleString()}</p></div><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground" aria-label="Close details sidebar" title="Close details sidebar"><X className="h-4 w-4 lg:hidden" /><PanelRightClose className="hidden h-5 w-5 lg:block" /></button></div>
      <div className="flex-1 space-y-6 overflow-y-auto p-5"><section><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Prompt</p><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{run.prompt}</p></section>{first.inputUrls.length > 0 && <section className="border-t border-border pt-5"><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Inputs</p><div className="mt-3 flex gap-2">{first.inputUrls.map((url) => <img key={url} src={url} alt="Input asset" className="h-16 w-16 rounded-ui object-cover" />)}</div></section>}<section className="border-t border-border pt-5"><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Parameters</p><dl className="mt-3 space-y-1">{details.filter((item): item is [string, string | number] => item[1] !== undefined).map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4 rounded-ui px-2 py-2 text-xs odd:bg-surface-soft"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium capitalize text-foreground">{value}</dd></div>)}</dl></section></div>
    </aside>
  );
}
