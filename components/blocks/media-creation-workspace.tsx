"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { PanelRight, Trash2, X } from "lucide-react";
import { GenerateForm } from "@/components/generate/generate-form";
import { VideoCreationForm } from "@/components/creation/video-creation-form";
import { CreationStream, type WorkspaceRun } from "@/components/blocks/creation-stream";
import { AssetsLibrary } from "@/components/blocks/assets-library";
import { WorkspaceMobileHeader, WorkspaceSidebar, type WorkspaceView } from "@/components/blocks/workspace-sidebar";
import { useToast } from "@/components/blocks/app-toast-provider";
import { creationIdentity, getCreationTimelineKey, mergeCreations, reconcileCreationSnapshot, type CreationHistoryItem, type GenerationParameters } from "@/lib/creation-history";
import {
  ComposerAttachments,
  ComposerToolbarLeading,
  type ActiveComposerType,
  type ComposerAssetOption,
  type ComposerAttachment,
} from "@/components/blocks/composer-input-controls";
import {
  getImageInputCapabilities,
  isCompatibleImageMetadata,
  getVideoInputCapabilities,
  type GenerationInputCapabilities,
} from "@/lib/generation-input-capabilities";
import { COMPOSER_TYPE_STORAGE_KEY } from "@/lib/composer-preference";
import { useSession } from "next-auth/react";
import { accountRequestHeaders, getAccountScope } from "@/lib/account-scope";
import { useAccountOperation } from "@/lib/use-account-operation";
import { GENERATION_STATUS_UNAVAILABLE } from "@/lib/generation-request-state";
import { InputMedia } from "@/components/creation/input-media";
import {
  WORKSPACE_PATHS,
  getWorkspaceDestination,
  type WorkspaceCreationDestination,
} from "@/lib/workspace-navigation";

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

function updateWorkspaceUrl(
  destination: WorkspaceCreationDestination | "assets",
  method: "pushState" | "replaceState"
) {
  const nextUrl = new URL(window.location.href);
  nextUrl.pathname = WORKSPACE_PATHS[destination];
  nextUrl.search = "";
  nextUrl.hash = "";
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`) return;
  window.history[method](window.history.state, "", nextUrl);
}

type WorkspaceProps = {
  initialType: ActiveComposerType;
  initialView?: WorkspaceView;
  initialCreations?: CreationHistoryItem[];
  initialAccountScope?: string | null;
  initialPrompt?: string;
};

export function MediaCreationWorkspace(props: WorkspaceProps) {
  const { data: session } = useSession();
  const accountScope = getAccountScope(session?.user);
  return <ScopedMediaCreationWorkspace key={accountScope || "anonymous"} {...props} accountScope={accountScope} initialPrompt={accountScope === (props.initialAccountScope ?? null) ? props.initialPrompt : undefined} initialCreations={accountScope && accountScope === props.initialAccountScope ? props.initialCreations : []} />;
}

function ScopedMediaCreationWorkspace({
  initialType,
  initialView = "create",
  initialCreations = [],
  initialPrompt,
  accountScope,
}: WorkspaceProps & { accountScope: string | null }) {
  const { capture: captureGeneration } = useAccountOperation();
  const { showToast } = useToast();
  const pathname = usePathname();
  const [view, setView] = useState<WorkspaceView>(initialView);
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
      : getVideoInputCapabilities("Seedance 2.0 Mini")
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [detailsRun, setDetailsRun] = useState<WorkspaceRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const preservedScrollTopRef = useRef<number | null>(null);
  const mutationRevision = useRef(0);
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
    try { window.localStorage.setItem(COMPOSER_TYPE_STORAGE_KEY, composerType); } catch { /* Optional preference storage. */ }
  }, [composerType]);

  useEffect(() => {
    const destination = getWorkspaceDestination(pathname);
    if (destination === "assets") {
      setView("assets");
      setDetailsRun(null);
      setDetailsOpen(false);
      return;
    }
    if (destination !== "image" && destination !== "video") return;
    setView("create");
    setComposerType(destination);
    setInputCapabilities(
      destination === "image"
        ? getImageInputCapabilities("gpt-image-2")
        : getVideoInputCapabilities("MiniMax H3")
    );
    setDetailsRun(null);
    setDetailsOpen(false);
  }, [pathname]);

  const activeGenerationCount = creations.filter((creation) => ["pending", "generating", "processing"].includes(creation.status) && !(creation.optimistic && creation.statusUncertain && !creation.taskId)).length;

  useEffect(() => {
    if (!accountScope) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      const revision = mutationRevision.current;
      try {
        const response = await fetch("/api/creations", { headers: accountRequestHeaders(accountScope), signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (controller.signal.aborted || !response.ok || data.accountScope !== accountScope || !Array.isArray(data.creations)) return;
        if (revision === mutationRevision.current) setCreations((current) => reconcileCreationSnapshot(current, data.creations));
        // Refresh/re-opened video tasks have no surviving form poller. The
        // server's storage lease makes overlapping reads safe.
        await Promise.allSettled((data.creations as CreationHistoryItem[])
          .filter((item) => item.type === "video" && item.taskId && ["pending", "generating", "processing"].includes(item.status))
          .map((item) => fetch(`/api/veo/generate?taskId=${encodeURIComponent(item.taskId!)}`, { headers: accountRequestHeaders(accountScope), signal: controller.signal, cache: "no-store" })));
      } catch { /* A transport failure is not a terminal generation failure. */ }
      finally { if (!controller.signal.aborted) timer = setTimeout(refresh, 10_000); }
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [accountScope]);

  const updateCreation = (identity: string, patch: Partial<CreationHistoryItem>) => {
    mutationRevision.current += 1;
    if (view === "create" && scrollRef.current) {
      preservedScrollTopRef.current = scrollRef.current.scrollTop;
    }
    setCreations((current) => current.map((creation) => creationIdentity(creation) === identity ? { ...creation, ...patch } : creation));
  };

  const openDetails = (run: WorkspaceRun) => {
    setDetailsRun(run);
    setDetailsOpen(true);
  };

  const applyComposerType = (nextType: ActiveComposerType, warnAboutAttachments = true) => {
    setComposerType(nextType);
    setInputCapabilities(
      nextType === "image"
        ? getImageInputCapabilities("gpt-image-2")
        : getVideoInputCapabilities("MiniMax H3")
    );
    if (warnAboutAttachments && draft.attachments.some((attachment) => attachment.kind !== "image")) {
      showToast({ title: "Some inputs need attention", message: "Remove inputs marked as unsupported or switch to a compatible model before creating.", variant: "warning" });
    }
  };

  const navigateWorkspace = (destination: WorkspaceCreationDestination | "assets") => {
    setDetailsRun(null);
    setDetailsOpen(false);
    if (destination === "assets") {
      if (view === "assets") return;
      setView("assets");
    } else {
      if (view === "create" && composerType === destination) return;
      setView("create");
      applyComposerType(destination);
    }
    updateWorkspaceUrl(destination, "pushState");
  };

  const setType = (nextType: ActiveComposerType) => {
    setView("create");
    applyComposerType(nextType);
    updateWorkspaceUrl(nextType, "replaceState");
  };

  const restoreCreation = (creation: CreationHistoryItem) => {
    if (creation.type === "music") {
      showToast({ title: "Audio generation is unavailable", message: "Suno has been retired. Existing audio remains available in Create and Assets.", variant: "warning" });
      return;
    }
    setView("create");
    applyComposerType(creation.type, false);
    updateWorkspaceUrl(creation.type, "replaceState");
    setDraft((current) => ({
      prompt: creation.prompt,
      attachments: creation.inputUrls.map((url, index) => ({
        id: `reprompt-${creationIdentity(creation)}-${index}`,
        url,
        kind: creation.parameters?.inputKinds?.[index] || "image",
        name: `Input ${creation.parameters?.inputKinds?.[index] || "image"} ${index + 1}`,
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
    updateWorkspaceUrl(composerType, "pushState");
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
    mutationRevision.current += 1;
    const optimistic = Array.from({ length: outputCount }, (_, index): CreationHistoryItem => ({
      id: `${optimisticId}-${index}`,
      optimistic: true,
      type,
      status: "generating",
      urls: [],
      inputUrls: draft.attachments
        .filter((attachment) => attachment.kind === "image" || attachment.kind === "video" || attachment.kind === "audio")
        .map((attachment) => attachment.url),
      prompt,
      createdAt: nowIso(),
      parameters: { ...parameters, inputKinds: draft.attachments.map((attachment) => attachment.kind), runId: optimisticId, outputIndex: index, outputCount },
    }));
    setCreations((current) => mergeCreations([...current, ...optimistic], []));
  };

  const updateOptimisticOutput = ({ optimisticId, outputIndex = 0, url, taskId, prompt, parameters, inputUrls, status, error, errorCode }: { optimisticId: string; outputIndex?: number; url?: string; taskId?: string; prompt?: string; parameters?: GenerationParameters; inputUrls?: string[]; status: CreationHistoryItem["status"]; error?: string; errorCode?: string }) => {
    mutationRevision.current += 1;
    setCreations((current) => current.map((creation) => {
      if (creation.parameters?.runId !== optimisticId || (creation.parameters.outputIndex ?? 0) !== outputIndex) return creation;
      if (creation.status === "deleted" || (!creation.optimistic && ["success", "failed"].includes(creation.status))) return creation;
      const isSettled = status === "success" || status === "failed";
      const processingDurationMs = parameters?.processingDurationMs ?? creation.parameters?.processingDurationMs ?? (isSettled ? Math.max(0, Date.now() - new Date(creation.createdAt).getTime()) : undefined);
      return { ...creation, statusUncertain: false, status, urls: url ? [url] : creation.urls, taskId: taskId || creation.taskId, prompt: prompt || creation.prompt, parameters: { ...creation.parameters, ...parameters, ...(processingDurationMs !== undefined ? { processingDurationMs } : {}), runId: optimisticId, outputIndex }, inputUrls: inputUrls || creation.inputUrls, error, errorCode };
    }));
  };

  const imageAttachments = draft.attachments.filter((attachment) => attachment.kind === "image");
  const markGenerationUncertain = ({ optimisticId, outputIndex = 0 }: { optimisticId: string; outputIndex?: number }) => {
    mutationRevision.current += 1;
    setCreations((current) => current.map((creation) => creation.parameters?.runId === optimisticId &&
      (creation.parameters.outputIndex ?? 0) === outputIndex && ["pending", "generating", "processing"].includes(creation.status)
      ? { ...creation, statusUncertain: true, error: GENERATION_STATUS_UNAVAILABLE } : creation));
  };
  const attachmentIncompatible = draft.attachments.some((attachment, index) => {
    if (attachment.kind === "video") {
      const kindIndex = draft.attachments.slice(0, index + 1).filter((item) => item.kind === "video").length;
      return kindIndex > inputCapabilities.maxVideos;
    }
    if (attachment.kind === "audio") {
      const kindIndex = draft.attachments.slice(0, index + 1).filter((item) => item.kind === "audio").length;
      return kindIndex > inputCapabilities.maxAudios;
    }
    const imageIndex = draft.attachments
      .slice(0, index + 1)
      .filter((item) => item.kind === "image").length - 1;
    return imageIndex >= inputCapabilities.maxImages || !isCompatibleImageMetadata(inputCapabilities, attachment);
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
      return <GenerateForm key={composerKey} captureGeneration={captureGeneration} onGenerationUncertain={markGenerationUncertain} variant="composer" initialPrompt={draft.prompt} initialImages={imageAttachments.map((attachment) => attachment.url)} initialParameters={draft.parametersByType.image} toolbarLeading={toolbarLeading} submissionBlocked={attachmentIncompatible} activeGenerationCount={activeGenerationCount} isGenerating={activeGenerationCount >= 5} setIsGenerating={() => undefined} onPromptChange={(prompt) => setDraft((current) => ({ ...current, prompt }))} onInputImagesChange={(urls) => setDraft((current) => ({ ...current, attachments: replaceImageAttachments(current.attachments, urls) }))} onInputCapabilityChange={setInputCapabilities} onParametersChange={(parameters) => setDraft((current) => ({ ...current, parametersByType: { ...current.parametersByType, image: parameters } }))} onGenerationStart={(data) => addOptimisticRun({ ...data, type: "image" })} onGenerationTaskCreated={({ optimisticId, taskId, outputIndex }) => updateOptimisticOutput({ optimisticId, outputIndex, taskId, status: "generating" })} onGenerate={(url, taskId, prompt, parameters, optimisticId, inputUrls, outputIndex) => optimisticId && updateOptimisticOutput({ optimisticId, outputIndex, url, taskId, prompt, parameters, inputUrls, status: "success" })} onGenerationFailure={({ optimisticId, taskId, prompt, error, errorCode, outputIndex }) => updateOptimisticOutput({ optimisticId, outputIndex, taskId, prompt, error, errorCode, status: "failed" })} />;
    }
    if (composerType === "video") {
      return <VideoCreationForm key={composerKey} captureGeneration={captureGeneration} onGenerationUncertain={markGenerationUncertain} variant="composer" initialPrompt={draft.prompt} initialImages={imageAttachments.map((attachment) => attachment.url)} inputAttachments={draft.attachments.map(({ url, kind }) => ({ url, kind }))} initialParameters={draft.parametersByType.video} toolbarLeading={toolbarLeading} submissionBlocked={attachmentIncompatible} activeGenerationCount={activeGenerationCount} onPromptChange={(prompt) => setDraft((current) => ({ ...current, prompt }))} onInputImagesChange={(urls) => setDraft((current) => ({ ...current, attachments: replaceImageAttachments(current.attachments, urls) }))} onInputAttachmentsChange={(attachments) => setDraft((current) => ({ ...current, attachments: attachments.map((attachment, index) => ({ ...attachment, id: `input-${index}-${attachment.url.slice(-24)}`, name: `Input ${attachment.kind} ${index + 1}`, source: "reference" })) }))} onInputCapabilityChange={setInputCapabilities} onParametersChange={(parameters) => setDraft((current) => ({ ...current, parametersByType: { ...current.parametersByType, video: parameters } }))} onGenerationStart={(data) => addOptimisticRun({ ...data, type: "video" })} onGenerationTaskCreated={({ optimisticId, taskId, prompt, inputUrls }) => updateOptimisticOutput({ optimisticId, taskId, prompt, inputUrls, status: "generating" })} onGenerate={(url, taskId, prompt, optimisticId, parameters, inputUrls) => optimisticId && updateOptimisticOutput({ optimisticId, url, taskId, prompt, parameters, inputUrls, status: "success" })} onGenerationFailure={({ optimisticId, prompt, error, errorCode }) => updateOptimisticOutput({ optimisticId, prompt, error, errorCode, status: "failed" })} />;
    }
    return null;
  })();
  const activeSection = view === "assets" ? "assets" : composerType;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <WorkspaceSidebar activeSection={activeSection} onWorkspaceNavigate={navigateWorkspace} collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} mobileOpen={mobileSidebarOpen} onMobileOpenChange={setMobileSidebarOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceMobileHeader onOpen={() => setMobileSidebarOpen(true)} />
        {view === "assets" ? <div className="min-h-0 flex-1 overflow-y-auto"><AssetsLibrary creations={creations} onReference={referenceAsset} onChange={updateCreation} /></div> : (
          <div className="flex min-h-0 flex-1">
            <main className="relative flex min-w-0 flex-1 flex-col">
              {!detailsOpen && (
                  <button
                    type="button"
                    onClick={() => detailsRun && setDetailsOpen(true)}
                    aria-disabled={!detailsRun}
                    className={`absolute right-3 top-3 z-20 hidden h-8 w-8 items-center justify-center rounded-md bg-transparent text-stone-500 transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400/50 lg:flex ${detailsRun ? "hover:bg-stone-100/80 hover:text-stone-700" : "cursor-default"}`}
                    aria-label="Open details sidebar"
                    title={detailsRun ? "Open details sidebar" : "Select Details on a result first"}
                  >
                    <PanelRight className="h-4 w-4" strokeWidth={1.5} />
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
  let videoCount = 0;
  let audioCount = 0;
  return attachments.filter((attachment) => {
    if (attachment.kind === "video") return ++videoCount <= capabilities.maxVideos;
    if (attachment.kind === "audio") return ++audioCount <= capabilities.maxAudios;
    imageCount += 1;
    return imageCount <= capabilities.maxImages && isCompatibleImageMetadata(capabilities, attachment);
  });
}

const MOBILE_DETAILS_QUERY = "(max-width: 1023px)";
function subscribeToDetailsLayout(notify: () => void) {
  const query = window.matchMedia(MOBILE_DETAILS_QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

function DetailsPanel({ run, onClose }: { run: WorkspaceRun; onClose: () => void }) {
  const mobile = useSyncExternalStore(subscribeToDetailsLayout,
    () => window.matchMedia(MOBILE_DETAILS_QUERY).matches, () => false);
  const first = run.creations[0];
  const details: Array<[string, string | number | undefined]> = [
    ["Type", run.type === "music" ? "Audio" : run.type],
    ["Status", run.creations.some((item) => item.status === "failed") ? "Partial / failed" : run.creations.every((item) => item.status === "success") ? "Complete" : "In progress"],
    ["Model", first.parameters?.model], ["Mode", first.parameters?.mode], ["Aspect ratio", first.parameters?.aspectRatio], ["Resolution", first.parameters?.resolution], ["Duration", first.parameters?.duration ? `${first.parameters.duration}s` : undefined], ["Audio", first.parameters?.audio], ["Credits", run.creations.reduce((sum, item) => sum + (item.creditsCost || 0), 0) || undefined],
  ];
  const contents = (
    <>
      <div className="relative flex h-16 items-center border-b border-border px-5 pr-14"><div><h2 className="text-sm font-medium text-foreground">Generation details</h2><p className="text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleString()}</p></div><button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-stone-500 transition-all duration-300 hover:bg-stone-100/80 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400/50" aria-label="Close details sidebar" title="Close details sidebar"><X className="h-4 w-4 lg:hidden" /><PanelRight className="hidden h-4 w-4 lg:block" strokeWidth={1.5} /></button></div>
      <div className="flex-1 space-y-6 overflow-y-auto p-5"><section><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Prompt</p><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{run.prompt}</p></section>{first.inputUrls.length > 0 && <section className="border-t border-border pt-5"><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Inputs</p><div className="mt-3 flex flex-wrap gap-2">{first.inputUrls.map((url, index) => <InputMedia key={`${url}-${index}`} creationId={first.taskId || first.id} url={url} index={index} kind={first.parameters?.inputKinds?.[index]} />)}</div></section>}<section className="border-t border-border pt-5"><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Parameters</p><dl className="mt-3 space-y-1">{details.filter((item): item is [string, string | number] => item[1] !== undefined).map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4 rounded-ui px-2 py-2 text-xs odd:bg-surface-soft"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium capitalize text-foreground">{value}</dd></div>)}</dl></section></div>
    </>
  );
  return mobile ? <Modal onClose={onClose} aria-label="Generation details" className="flex flex-col bg-background">{contents}</Modal>
    : <aside aria-label="Generation details" className="flex w-80 flex-col border-l border-border bg-background xl:w-96"
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>{contents}</aside>;
}
