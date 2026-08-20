"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PanelRightClose, PanelRightOpen, Trash2, X } from "lucide-react";
import { GenerateForm } from "@/components/generate/generate-form";
import { VideoCreationForm } from "@/components/creation/video-creation-form";
import { CreationStream, type WorkspaceRun } from "@/components/blocks/creation-stream";
import { AssetsLibrary } from "@/components/blocks/assets-library";
import { WorkspaceMobileHeader, WorkspaceSidebar, type WorkspaceView } from "@/components/blocks/workspace-sidebar";
import { useToast } from "@/components/blocks/app-toast-provider";
import { creationIdentity, getCreationTimelineKey, mergeCreations, type CreationHistoryItem, type GenerationParameters } from "@/lib/creation-history";
import {
  ComposerAttachments,
  ComposerToolbarLeading,
  type ActiveComposerType,
  type ComposerAssetOption,
  type ComposerAttachment,
} from "@/components/blocks/composer-input-controls";
import {
  getImageInputCapabilities,
  getVideoInputCapabilities,
  type GenerationInputCapabilities,
} from "@/lib/generation-input-capabilities";
import { COMPOSER_TYPE_STORAGE_KEY } from "@/lib/composer-preference";

type ComposerType = CreationHistoryItem["type"];

interface DraftSeed {
  prompt: string;
  attachments: ComposerAttachment[];
  parametersByType: Partial<Record<ActiveComposerType, GenerationParameters>>;
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
  initialType: ActiveComposerType;
  initialCreations?: CreationHistoryItem[];
  initialPrompt?: string;
}) {
  const { showToast } = useToast();
  const [view, setView] = useState<WorkspaceView>("create");
  const [composerType, setComposerType] = useState<ActiveComposerType>(initialType);
  const [creations, setCreations] = useState<CreationHistoryItem[]>(initialCreations);
  const [draft, setDraft] = useState<DraftSeed>({
    prompt: initialPrompt || "",
    attachments: [],
    parametersByType: {},
    revision: 0,
  });
  const [inputCapabilities, setInputCapabilities] = useState<GenerationInputCapabilities>(
    initialType === "image"
      ? getImageInputCapabilities("gpt-image-2")
      : getVideoInputCapabilities("MiniMax H3")
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [detailsRun, setDetailsRun] = useState<WorkspaceRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const preservedScrollTopRef = useRef<number | null>(null);
  const creationTimelineKey = getCreationTimelineKey(creations);

  useLayoutEffect(() => {
    if (preservedScrollTopRef.current === null || !scrollRef.current) return;
    scrollRef.current.scrollTop = preservedScrollTopRef.current;
    preservedScrollTopRef.current = null;
  }, [creations]);

  useEffect(() => {
    const target = scrollRef.current;
    if (!target || view !== "create") return;
    target.scrollTop = target.scrollHeight;
  }, [creationTimelineKey, view]);

  useEffect(() => {
    window.localStorage.setItem(COMPOSER_TYPE_STORAGE_KEY, composerType);
  }, [composerType]);

  const activeImageCount = creations.filter((creation) => creation.type === "image" && ["pending", "generating", "processing"].includes(creation.status)).length;
  const activeVideoCount = creations.filter((creation) => creation.type === "video" && ["pending", "generating", "processing"].includes(creation.status)).length;

  const updateCreation = (identity: string, patch: Partial<CreationHistoryItem>) => {
    if (view === "create" && scrollRef.current) {
      preservedScrollTopRef.current = scrollRef.current.scrollTop;
    }
    setCreations((current) => current.map((creation) => creationIdentity(creation) === identity ? { ...creation, ...patch } : creation));
  };

  const resetDraft = () => setDraft((current) => ({
    ...current,
    prompt: "",
    attachments: [],
    revision: current.revision + 1,
  }));

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

  const setType = (nextType: ActiveComposerType) => {
    setComposerType(nextType);
    setInputCapabilities(
      nextType === "image"
        ? getImageInputCapabilities("gpt-image-2")
        : getVideoInputCapabilities("MiniMax H3")
    );
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = nextType === "image" ? "/ai-image" : "/ai-video";
    window.history.replaceState(window.history.state, "", nextUrl);
    if (draft.attachments.some((attachment) => attachment.kind !== "image")) {
      showToast({ title: "Some inputs need attention", message: "Remove inputs marked as unsupported or switch to a compatible model before creating.", variant: "warning" });
    }
  };

  const restoreCreation = (creation: CreationHistoryItem) => {
    if (creation.type === "music") {
      showToast({ title: "Audio generation is unavailable", message: "Suno has been retired. Existing audio remains available in Create and Assets.", variant: "warning" });
      return;
    }
    setView("create");
    setComposerType(creation.type);
    setDraft((current) => ({
      prompt: creation.prompt,
      attachments: creation.inputUrls.map((url, index) => ({
        id: `reprompt-${creationIdentity(creation)}-${index}`,
        url,
        kind: "image" as const,
        name: `Input image ${index + 1}`,
        source: "reference" as const,
      })),
      parametersByType: {
        ...current.parametersByType,
        [creation.type]: creation.parameters,
      },
      revision: current.revision + 1,
    }));
  };

  const referenceAsset = (creation: CreationHistoryItem, url: string) => {
    setView("create");
    const kind = creation.type === "music" ? "audio" : creation.type;
    setDraft((current) => current.attachments.some((attachment) => attachment.url === url)
      ? current
      : {
          ...current,
          attachments: [
            ...current.attachments,
            {
              id: `reference-${creationIdentity(creation)}-${current.attachments.length}`,
              url,
              kind,
              name: `${kind === "audio" ? "Audio" : kind[0].toUpperCase() + kind.slice(1)} result`,
              source: "reference",
            },
          ],
        });
    if (kind !== "image") {
      showToast({ title: "Attachment is not compatible", message: "This generator cannot use that media type yet. The attachment is marked and generation is blocked.", variant: "warning" });
    }
  };

  const addOptimisticRun = ({ optimisticId, prompt, parameters, outputCount = 1, type }: { optimisticId: string; prompt: string; parameters: GenerationParameters; outputCount?: number; type: ComposerType }) => {
    const optimistic = Array.from({ length: outputCount }, (_, index): CreationHistoryItem => ({
      id: `${optimisticId}-${index}`,
      type,
      status: "generating",
      urls: [],
      inputUrls: draft.attachments
        .filter((attachment) => attachment.kind === "image")
        .slice(0, inputCapabilities.maxImages)
        .map((attachment) => attachment.url),
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

  const imageAttachments = draft.attachments.filter((attachment) => attachment.kind === "image");
  const attachmentIncompatible = draft.attachments.some((attachment, index) => {
    if (attachment.kind === "video") return !inputCapabilities.acceptsVideo;
    if (attachment.kind === "audio") return !inputCapabilities.acceptsAudio;
    const imageIndex = draft.attachments
      .slice(0, index + 1)
      .filter((item) => item.kind === "image").length - 1;
    return imageIndex >= inputCapabilities.maxImages;
  });
  const assetOptions = useMemo<ComposerAssetOption[]>(() => {
    const seen = new Set<string>();
    return creations.flatMap((creation) => {
      if (creation.status !== "success") return [];
      const kind = creation.type === "music" ? "audio" : creation.type;
      return creation.urls.flatMap((url, index) => {
        if (!url || seen.has(url)) return [];
        seen.add(url);
        return [{
          id: `${creationIdentity(creation)}-${index}`,
          url,
          kind,
          name: `${kind === "audio" ? "Audio" : kind[0].toUpperCase() + kind.slice(1)} result`,
        }];
      });
    });
  }, [creations]);
  const toolbarLeading = (
    <ComposerToolbarLeading
      composerType={composerType}
      capabilities={inputCapabilities}
      attachments={draft.attachments}
      assets={assetOptions}
      onTypeChange={setType}
      onAdd={(attachments) => setDraft((current) => ({
        ...current,
        attachments: [...current.attachments, ...attachments],
      }))}
    />
  );
  const composerKey = `${composerType}-${draft.revision}`;
  const composer = (() => {
    if (composerType === "image") {
      return <GenerateForm key={composerKey} variant="composer" initialPrompt={draft.prompt} initialImages={imageAttachments.map((attachment) => attachment.url)} initialParameters={draft.parametersByType.image} toolbarLeading={toolbarLeading} submissionBlocked={attachmentIncompatible} activeGenerationCount={activeImageCount} isGenerating={activeImageCount >= 5} setIsGenerating={() => undefined} onPromptChange={(prompt) => setDraft((current) => ({ ...current, prompt }))} onInputImagesChange={(urls) => setDraft((current) => ({ ...current, attachments: replaceImageAttachments(current.attachments, urls) }))} onInputCapabilityChange={setInputCapabilities} onParametersChange={(parameters) => setDraft((current) => ({ ...current, parametersByType: { ...current.parametersByType, image: parameters } }))} onGenerationStart={(data) => addOptimisticRun({ ...data, type: "image" })} onGenerationTaskCreated={({ optimisticId, taskId, outputIndex }) => updateOptimisticOutput({ optimisticId, outputIndex, taskId, status: "generating" })} onGenerate={(url, taskId, prompt, parameters, optimisticId, inputUrls, outputIndex) => optimisticId && updateOptimisticOutput({ optimisticId, outputIndex, url, taskId, prompt, parameters, inputUrls, status: "success" })} onGenerationFailure={({ optimisticId, taskId, prompt, error, errorCode, outputIndex }) => updateOptimisticOutput({ optimisticId, outputIndex, taskId, prompt, error, errorCode, status: "failed" })} />;
    }
    if (composerType === "video") {
      return <VideoCreationForm key={composerKey} variant="composer" initialPrompt={draft.prompt} initialImages={imageAttachments.map((attachment) => attachment.url)} initialParameters={draft.parametersByType.video} toolbarLeading={toolbarLeading} submissionBlocked={attachmentIncompatible} activeGenerationCount={activeVideoCount} onPromptChange={(prompt) => setDraft((current) => ({ ...current, prompt }))} onInputImagesChange={(urls) => setDraft((current) => ({ ...current, attachments: replaceImageAttachments(current.attachments, urls) }))} onInputCapabilityChange={setInputCapabilities} onParametersChange={(parameters) => setDraft((current) => ({ ...current, parametersByType: { ...current.parametersByType, video: parameters } }))} onGenerationStart={(data) => addOptimisticRun({ ...data, type: "video" })} onGenerationTaskCreated={({ optimisticId, taskId, prompt, inputUrls }) => updateOptimisticOutput({ optimisticId, taskId, prompt, inputUrls, status: "generating" })} onGenerate={(url, taskId, prompt, optimisticId, parameters, inputUrls) => optimisticId && updateOptimisticOutput({ optimisticId, url, taskId, prompt, parameters, inputUrls, status: "success" })} onGenerationFailure={({ optimisticId, prompt, error, errorCode }) => updateOptimisticOutput({ optimisticId, prompt, error, errorCode, status: "failed" })} />;
    }
    return null;
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
                <div className="pointer-events-auto mx-auto w-full max-w-4xl rounded-ui-xl border border-border bg-background p-2.5 shadow-float sm:p-3">
                  <ComposerAttachments attachments={draft.attachments} capabilities={inputCapabilities} onRemove={(id) => setDraft((current) => ({ ...current, attachments: current.attachments.filter((attachment) => attachment.id !== id) }))} />
                  {attachmentIncompatible && <div className="mt-2 flex items-center gap-2 rounded-ui bg-destructive/5 px-2 py-1.5"><Trash2 className="h-3.5 w-3.5 text-destructive" /><p className="min-w-0 flex-1 text-[11px] text-destructive">Remove inputs marked as unsupported before creating.</p><button type="button" onClick={() => setDraft((current) => ({ ...current, attachments: filterCompatibleAttachments(current.attachments, inputCapabilities) }))} className="text-[11px] font-medium text-destructive underline underline-offset-2">Remove unsupported</button></div>}
                  {composer}
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

function replaceImageAttachments(
  attachments: ComposerAttachment[],
  urls: string[]
) {
  const existingImages = attachments.filter((attachment) => attachment.kind === "image");
  const replacements = urls.map((url, index): ComposerAttachment =>
    existingImages.find((attachment) => attachment.url === url) || {
      id: `input-${index}-${url.slice(-24)}`,
      url,
      kind: "image",
      name: `Input image ${index + 1}`,
      source: "reference",
    }
  );
  return [...replacements, ...attachments.filter((attachment) => attachment.kind !== "image")];
}

function filterCompatibleAttachments(
  attachments: ComposerAttachment[],
  capabilities: GenerationInputCapabilities
) {
  let imageCount = 0;
  return attachments.filter((attachment) => {
    if (attachment.kind === "video") return capabilities.acceptsVideo;
    if (attachment.kind === "audio") return capabilities.acceptsAudio;
    imageCount += 1;
    return imageCount <= capabilities.maxImages;
  });
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
