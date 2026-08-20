"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  Clock3,
  Download,
  FileWarning,
  Image as ImageIcon,
  Loader2,
  Music,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Trash2,
  Video,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreationPreviewDialog } from "@/components/blocks/creation-preview-dialog";
import {
  creationIdentity,
  getRegenerationInputImage,
  mergeCreations,
  normalizeGenerationParameters,
  type CreationHistoryItem,
  type CreationStatus,
} from "@/lib/creation-history";
import {
  getGenerationErrorDisplay,
  isGenerationErrorCode,
  type GenerationErrorCode,
} from "@/lib/generation-errors";
import { trackEvent } from "@/lib/analytics";
import { buildCreationDownloadPath } from "@/lib/creation-download";
import { useToast } from "@/components/blocks/app-toast-provider";
import type { PanelGeneration } from "./result-panel";

type Creation = CreationHistoryItem;

const VALID_STATUS: CreationStatus[] = ["pending", "generating", "processing", "success", "failed", "deleted"];
const LEGACY_STATUS_MAP: Record<string, CreationStatus> = {
  completed: "success",
  done: "success",
  error: "failed",
};

function isCreationStatus(value: unknown): value is CreationStatus {
  return typeof value === "string" && VALID_STATUS.includes(value as CreationStatus);
}

function isValidMediaUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;

  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return true;

  try {
    const protocol = new URL(trimmed).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeCreation(raw: unknown): Creation | null {
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Partial<Creation> & {
    url?: unknown;
    imageUrl?: unknown;
    videoUrl?: unknown;
    audioUrl?: unknown;
    outputUrl?: unknown;
    resultUrl?: unknown;
  };
  const type = candidate.type;
  if (type !== "image" && type !== "video" && type !== "music") return null;
  if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) return null;

  const urlsFromArray = Array.isArray(candidate.urls)
    ? candidate.urls
        .filter(isValidMediaUrl)
        .map((url) => url.trim())
    : [];
  const urlsFromLegacy = [
    candidate.url,
    candidate.imageUrl,
    candidate.videoUrl,
    candidate.audioUrl,
    candidate.outputUrl,
    candidate.resultUrl,
  ]
    .filter(isValidMediaUrl)
    .map((url) => url.trim());
  const urls = [...urlsFromArray, ...urlsFromLegacy].filter(
    (url, index, list) => list.indexOf(url) === index
  );
  const inputUrls = Array.isArray(candidate.inputUrls)
    ? candidate.inputUrls.filter(isValidMediaUrl).map((url) => url.trim())
    : [];

  const rawStatus = typeof candidate.status === "string" ? candidate.status.toLowerCase() : "";
  const mappedStatus = LEGACY_STATUS_MAP[rawStatus];
  const status = isCreationStatus(candidate.status)
    ? candidate.status
    : mappedStatus || "failed";
  const normalizedStatus =
    status === "success" && (type === "image" || type === "video") && urls.length === 0
      ? "failed"
      : status;

  return {
    id: candidate.id,
    type,
    status: normalizedStatus,
    urls,
    inputUrls,
    prompt: typeof candidate.prompt === "string" ? candidate.prompt : "",
    createdAt:
      typeof candidate.createdAt === "string" && candidate.createdAt.trim().length > 0
        ? candidate.createdAt
        : new Date().toISOString(),
    taskId: typeof candidate.taskId === "string" ? candidate.taskId : undefined,
    error:
      normalizedStatus === "failed"
        ? typeof candidate.error === "string" && candidate.error.trim().length > 0
          ? candidate.error
          : "Media not available"
        : undefined,
    errorCode: isGenerationErrorCode(candidate.errorCode)
      ? candidate.errorCode
      : undefined,
    modelOptionId:
      typeof candidate.modelOptionId === "string" ? candidate.modelOptionId : undefined,
    creditsCost:
      typeof candidate.creditsCost === "number" ? candidate.creditsCost : undefined,
    parameters: normalizeGenerationParameters(candidate.parameters),
  };
}

function shouldPersistCreation(creation: Creation) {
  if (
    creation.type === "image" &&
    (creation.status === "pending" ||
      creation.status === "generating" ||
      creation.status === "processing")
  ) {
    return false;
  }

  return true;
}

interface MyCreationsTabProps {
  mode: "video" | "image" | "music";
  initialCreations?: Creation[];
  currentGeneration?: PanelGeneration;
  currentGenerations?: PanelGeneration[];
}

function getCreationStorageKeys(session: {
  user?: { id?: string | null; email?: string | null };
} | null): string[] {
  const keys = [
    session?.user?.id ? `creations_${session.user.id}` : null,
    session?.user?.email ? `creations_${session.user.email}` : null,
  ].filter((item): item is string => !!item);

  return Array.from(new Set(keys));
}

function removeStoredCreation(
  storageKeys: string[],
  id: string,
  targetIdentity: string
) {
  for (const key of storageKeys) {
    const stored = localStorage.getItem(key);
    if (!stored) continue;

    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) continue;

      const next = parsed.filter((item) => {
        const creation = normalizeCreation(item);
        if (!creation) return true;
        return (
          creation.id !== id &&
          creation.taskId !== id &&
          creationIdentity(creation) !== targetIdentity
        );
      });

      if (next.length > 0) {
        localStorage.setItem(key, JSON.stringify(next));
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error("Error removing stored creation:", error);
    }
  }
}

function isUserFixableGenerationError(code: GenerationErrorCode) {
  return [
    "content_policy",
    "prompt_required",
    "input_image_required",
    "unsupported_file_type",
    "file_too_large",
    "invalid_image",
    "invalid_parameters",
    "insufficient_credits",
  ].includes(code);
}

function GenerationFailureIcon({
  code,
  className,
}: {
  code: GenerationErrorCode;
  className: string;
}) {
  if (code === "content_policy") return <ShieldAlert className={className} />;
  if (
    code === "unsupported_file_type" ||
    code === "file_too_large" ||
    code === "invalid_image" ||
    code === "input_image_required"
  ) {
    return <FileWarning className={className} />;
  }
  if (code === "invalid_parameters" || code === "prompt_required") {
    return <Settings2 className={className} />;
  }
  if (code === "timeout") return <Clock3 className={className} />;
  if (code === "network_error") return <WifiOff className={className} />;
  return <AlertTriangle className={className} />;
}

function CreationImagePreview({
  creation,
  displayUrl,
  originalUrl,
  hasMultiple,
  mediaFailed,
  isRefreshingMedia,
  onToggleExpand,
  onPreview,
  onMediaError,
}: {
  creation: Creation;
  displayUrl: string;
  originalUrl: string;
  hasMultiple: boolean;
  mediaFailed: boolean;
  isRefreshingMedia: boolean;
  onToggleExpand: () => void;
  onPreview: (url: string) => void;
  onMediaError: (creation: Creation, originalUrl: string) => void;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const image = imageRef.current;
    setIsLoaded(!!image && image.complete && image.naturalWidth > 0);
  }, [displayUrl]);

  useEffect(() => {
    if (mediaFailed || isRefreshingMedia || isLoaded) return;

    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      setIsLoaded(true);
      return;
    }

    const timeout = window.setTimeout(() => {
      const currentImage = imageRef.current;
      if (!currentImage || !currentImage.complete || currentImage.naturalWidth === 0) {
        onMediaError(creation, originalUrl);
      }
    }, 12_000);

    return () => window.clearTimeout(timeout);
  }, [
    creation,
    displayUrl,
    isLoaded,
    isRefreshingMedia,
    mediaFailed,
    onMediaError,
    originalUrl,
  ]);

  if (mediaFailed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-stone-100 px-3 text-center">
        <ImageIcon className="h-8 w-8 text-stone-400" />
        <p className="mt-2 text-[11px] text-stone-500">
          Media expired
        </p>
      </div>
    );
  }

  return (
    <>
      <img
        ref={imageRef}
        src={displayUrl}
        alt={creation.prompt}
        className="h-full w-full cursor-pointer object-contain"
        onClick={() => {
          if (hasMultiple) {
            onToggleExpand();
          } else {
            onPreview(displayUrl);
          }
        }}
        onError={() => onMediaError(creation, originalUrl)}
        onLoad={(event) => {
          if (event.currentTarget.naturalWidth === 0) {
            onMediaError(creation, originalUrl);
            return;
          }
          setIsLoaded(true);
        }}
        loading="lazy"
      />
      {isRefreshingMedia && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100/80">
          <Loader2 className="h-6 w-6 animate-spin text-stone-500" />
        </div>
      )}
    </>
  );
}

function isVercelBlobUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function MyCreationsTab({
  mode,
  initialCreations = [],
  currentGeneration,
  currentGenerations,
}: MyCreationsTabProps) {
  const { data: session, status } = useSession();
  const { showToast } = useToast();
  const router = useRouter();
  const [creations, setCreations] = useState<Creation[]>(initialCreations);
  const [selectedPreview, setSelectedPreview] = useState<{
    creation: Creation;
    url: string;
  } | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [failedMedia, setFailedMedia] = useState<Set<string>>(new Set());
  const [resolvedMediaUrls, setResolvedMediaUrls] = useState<Record<string, string>>({});
  const [refreshingMedia, setRefreshingMedia] = useState<Set<string>>(new Set());
  const [mediaRetryCounts, setMediaRetryCounts] = useState<Record<string, number>>({});
  const generationItems = useMemo(
    () => currentGenerations ?? (currentGeneration ? [currentGeneration] : []),
    [currentGeneration, currentGenerations]
  );
  const visibleCreations = mergeCreations(creations, []).filter((creation) => creation.type === mode);
  const pollingTaskIds = useMemo(
    () =>
      mode === "video"
        ? visibleCreations
            .filter(
              (creation) =>
                (creation.status === "generating" || creation.status === "processing") &&
                !!creation.taskId
            )
            .map((creation) => creation.taskId as string)
        : [],
    [mode, visibleCreations]
  );
  const pollingTaskKey = pollingTaskIds.join(",");
  const pendingDeleteCreation = pendingDeleteId
    ? creations.find((c) => c.id === pendingDeleteId || c.taskId === pendingDeleteId)
    : null;

  // 优先从后端拉取历史，并兼容迁移老 localStorage 数据
  useEffect(() => {
    if (!session?.user?.id) return;

    const storageKeys = getCreationStorageKeys(session);

    const readLocal = () => {
      const parsedAll: Creation[] = [];
      for (const key of storageKeys) {
        const stored = localStorage.getItem(key);
        if (!stored) continue;
        try {
          const parsed = JSON.parse(stored);
          const normalized = Array.isArray(parsed)
            ? parsed
                .map((item) => normalizeCreation(item))
                .filter((item): item is Creation => !!item)
                .filter(shouldPersistCreation)
            : [];
          parsedAll.push(...normalized);
        } catch (error) {
          console.error("Error parsing stored creations:", error);
        }
      }
      return mergeCreations(parsedAll, []);
    };

    const localCreations = readLocal();
    const seededCreations = mergeCreations(initialCreations, localCreations);
    if (seededCreations.length > 0) {
      setCreations(seededCreations);
    }

    fetch(`/api/creations?type=${mode}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const fromApi = Array.isArray(data?.creations)
          ? data.creations
              .map((item: unknown) => normalizeCreation(item))
              .filter((item: Creation | null): item is Creation => !!item)
          : [];
        const merged = mergeCreations(fromApi, seededCreations);
        setCreations(merged);
      })
      .catch((error) => {
        console.error("Error fetching creations:", error);
      });
  }, [mode, session, initialCreations]);

  // 处理新的生成任务
  useEffect(() => {
    if (!session?.user?.id) return;

    for (const generation of generationItems) {
      const identity = generation.taskId || generation.optimisticId;
      if (!identity) continue;

      const taskId = generation.taskId;
      const optimisticId = generation.optimisticId;
      const status = (
        generation.error
          ? "failed"
          : generation.url
            ? "success"
            : generation.isGenerating
              ? "generating"
              : "pending"
      ) as CreationStatus;

      setCreations((prev) => {
        const exists = prev.find((c) => {
          const itemIdentity = creationIdentity(c);
          return itemIdentity === identity || itemIdentity === taskId || itemIdentity === optimisticId;
        });
        if (exists) {
          const updated = prev.map((c) =>
            creationIdentity(c) === identity ||
            creationIdentity(c) === taskId ||
            creationIdentity(c) === optimisticId
              ? {
                  ...c,
                  id: taskId || c.id,
                  status,
                  urls: generation.url ? [generation.url] : c.urls,
                  inputUrls: generation.inputUrls || c.inputUrls,
                  prompt: generation.prompt || c.prompt,
                  parameters: generation.parameters || c.parameters,
                  taskId: taskId || c.taskId || optimisticId,
                  error: generation.error,
                  errorCode: generation.errorCode,
                }
              : c
          );
          return mergeCreations(updated, []);
        } else {
          const newCreation: Creation = {
            id: identity,
            type: mode,
            status,
            urls: generation.url ? [generation.url] : [],
            inputUrls: generation.inputUrls || [],
            prompt: generation.prompt || "",
            parameters: generation.parameters,
            createdAt: new Date().toISOString(),
            taskId: taskId || optimisticId,
            error: generation.error,
            errorCode: generation.errorCode,
          };
          return mergeCreations([newCreation], prev);
        }
      });
    }
  }, [
    generationItems,
    mode,
    session?.user?.id,
  ]);

  // 保存到 localStorage
  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    const storageKey = `creations_${session.user.id}`;
    const normalizedCreations = mergeCreations(
      creations.filter(shouldPersistCreation),
      []
    );

    if (normalizedCreations.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(normalizedCreations));
      return;
    }

    localStorage.removeItem(storageKey);
  }, [creations, session]);

  useEffect(() => {
    if (mode !== "video" || pollingTaskKey.length === 0) {
      return;
    }

    let cancelled = false;
    const taskIds = pollingTaskKey.split(",").filter(Boolean);

    const pollTasks = async () => {
      for (const taskId of taskIds) {
        try {
          const res = await fetch(
            `/api/veo/generate?taskId=${encodeURIComponent(taskId)}`
          );
          const data = await res.json().catch(() => null);
          if (cancelled || data?.pending) {
            continue;
          }

          if (res.ok && data?.success && data?.videoUrl) {
            setCreations((prev) =>
              mergeCreations(
                prev.map((creation) =>
                  creation.taskId === taskId
                    ? {
                        ...creation,
                        status: "success",
                        urls: [data.videoUrl],
                        inputUrls: Array.isArray(data.inputUrls)
                          ? data.inputUrls
                          : creation.inputUrls,
                        prompt: data.prompt || creation.prompt,
                        parameters:
                          normalizeGenerationParameters(data.parameters) ||
                          creation.parameters,
                        error: undefined,
                      }
                    : creation
                ),
                []
              )
            );
            continue;
          }

          if (!res.ok || data?.success === false) {
            setCreations((prev) =>
              mergeCreations(
                prev.map((creation) =>
                  creation.taskId === taskId
                    ? {
                        ...creation,
                        status: "failed",
                        error: data?.error || "Generation failed.",
                      }
                    : creation
                ),
                []
              )
            );
          }
        } catch (error) {
          console.error("Error polling video generation:", error);
        }
      }
    };

    pollTasks();
    const interval = window.setInterval(pollTasks, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mode, pollingTaskKey]);

  const deleteCreation = (id: string) => {
    const target = creations.find((c) => c.id === id || c.taskId === id);
    const targetIdentity = target ? creationIdentity(target) : id;
    const deleteId = targetIdentity || id;

    setCreations((prev) =>
      prev.filter((c) => c.id !== id && c.taskId !== id && creationIdentity(c) !== targetIdentity)
    );
    removeStoredCreation(getCreationStorageKeys(session), id, targetIdentity);
    setFailedMedia((prev) => {
      if (!prev.has(id) && !prev.has(targetIdentity)) return prev;
      const next = new Set(prev);
      next.delete(id);
      next.delete(targetIdentity);
      return next;
    });
    setResolvedMediaUrls((prev) => {
      if (!prev[id] && !prev[targetIdentity]) return prev;
      const next = { ...prev };
      delete next[id];
      delete next[targetIdentity];
      return next;
    });
    fetch(`/api/creations?id=${encodeURIComponent(deleteId)}`, {
      method: "DELETE",
    }).catch((error) => {
      console.error("Error deleting creation:", error);
    });
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    deleteCreation(pendingDeleteId);
    setPendingDeleteId(null);
  };

  const handleRetry = (creation: Creation) => {
    const params = new URLSearchParams();

    if (creation.prompt.trim()) {
      params.set("prompt", creation.prompt);
    }

    const inputImage = getRegenerationInputImage(creation);
    if (inputImage) {
      params.set("image", inputImage);
    } else if (
      creation.type !== "music" &&
      creation.parameters?.mode?.toLowerCase().includes("image to")
    ) {
      showToast({
        title: "Original image unavailable",
        message: "This older creation did not save its input image. Upload the original image before generating again.",
        variant: "warning",
      });
    }

    const basePath =
      creation.type === "image"
        ? "/ai-image"
        : creation.type === "video"
          ? "/ai-video"
          : "/ai-image";

    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  };

  const handleDownload = (creation: Creation, url: string) => {
    trackEvent("result_download_clicked", { type: creation.type });
    const link = document.createElement("a");
    link.href = buildCreationDownloadPath(creation.id, url);
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMediaError = async (creation: Creation, originalUrl: string) => {
    const key = creationIdentity(creation);
    if (!originalUrl || refreshingMedia.has(key)) return;

    if (isVercelBlobUrl(originalUrl)) {
      const retryCount = mediaRetryCounts[key] || 0;
      if (retryCount < 3) {
        setMediaRetryCounts((prev) => ({
          ...prev,
          [key]: retryCount + 1,
        }));
        setRefreshingMedia((prev) => new Set(prev).add(key));
        window.setTimeout(() => {
          setResolvedMediaUrls((prev) => ({
            ...prev,
            [key]: `${originalUrl}${originalUrl.includes("?") ? "&" : "?"}retry=${Date.now()}`,
          }));
          setRefreshingMedia((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, 1_500);
        return;
      }

      setFailedMedia((prev) => new Set(prev).add(key));
      return;
    }

    if (resolvedMediaUrls[key]) {
      setFailedMedia((prev) => new Set(prev).add(key));
      return;
    }

    setRefreshingMedia((prev) => new Set(prev).add(key));
    try {
      const res = await fetch("/api/creations/media-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creationId: creation.id,
          url: originalUrl,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        url?: string;
      } | null;

      const refreshedUrl = data?.url;
      if (!res.ok || typeof refreshedUrl !== "string" || refreshedUrl.trim().length === 0) {
        throw new Error("Media refresh failed");
      }

      setResolvedMediaUrls((prev) => ({
        ...prev,
        [key]: refreshedUrl,
      }));
    } catch (error) {
      console.error("Error refreshing media URL:", error);
      setFailedMedia((prev) => new Set(prev).add(key));
    } finally {
      setRefreshingMedia((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // 空状态
  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-xl bg-stone-200/80" />
          <div className="mx-auto h-4 w-48 animate-pulse rounded bg-stone-200/80" />
          <div className="mx-auto h-3 w-64 animate-pulse rounded bg-stone-100" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="mb-4 text-stone-400">
            {mode === "video" ? (
              <Video className="h-16 w-16 mx-auto" />
            ) : mode === "image" ? (
              <ImageIcon className="h-16 w-16 mx-auto" />
            ) : (
              <Music className="h-16 w-16 mx-auto" />
            )}
          </div>
          <p className="mb-2 text-lg font-medium text-stone-600">
            Sign in to view your creations
          </p>
          <p className="text-sm text-stone-500">
            Your generated content will appear here
          </p>
        </div>
      </div>
    );
  }

  if (visibleCreations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="mb-4 text-stone-400">
            {mode === "video" ? (
              <Video className="h-16 w-16 mx-auto" />
            ) : mode === "image" ? (
              <ImageIcon className="h-16 w-16 mx-auto" />
            ) : (
              <Music className="h-16 w-16 mx-auto" />
            )}
          </div>
          <p className="mb-2 text-lg font-medium text-stone-600">
            You haven&apos;t created anything yet
          </p>
          <p className="text-sm text-stone-500">
            Start generating to see your creations here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {visibleCreations.map((creation) => {
          const key = creationIdentity(creation);
          const isExpanded = expandedTask === key;
          const originalDisplayUrl = creation.urls[0];
          const displayUrl = resolvedMediaUrls[key] || originalDisplayUrl;
          const hasMultiple = creation.urls.length > 1;
          const mediaFailed = failedMedia.has(key);
          const isRefreshingMedia = refreshingMedia.has(key);
          const failedErrorDisplay =
            creation.status === "failed"
              ? getGenerationErrorDisplay(
                  creation.errorCode
                    ? { errorCode: creation.errorCode }
                    : creation.error,
                  { mediaType: creation.type === "video" ? "video" : "image" }
                )
              : null;
          const userFixableFailure = failedErrorDisplay
            ? isUserFixableGenerationError(failedErrorDisplay.code)
            : false;

          return (
            <div
              key={key}
              className="group relative overflow-hidden rounded-xl border border-stone-200/50 bg-white shadow-sm transition-all duration-300 hover:shadow-md"
            >
              {/* 封面 */}
              <div className="relative aspect-square bg-stone-100">
                {creation.status === "pending" || creation.status === "generating" ? (
                  <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-stone-50">
                    <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-stone-100 via-white to-stone-200" />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/80 to-transparent" />
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-stone-200/70 bg-white/90 shadow-sm">
                      <div className="absolute h-14 w-14 animate-ping rounded-full bg-stone-300/30" />
                      <Loader2 className="relative h-6 w-6 animate-spin text-stone-700" />
                    </div>
                    <p className="relative mt-3 text-xs font-medium text-stone-700">
                      {creation.status === "pending" ? "Queued" : "Generating..."}
                    </p>
                  </div>
                ) : creation.status === "processing" ? (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-stone-50 opacity-50">
                    <Loader2 className="mb-2 h-8 w-8 animate-spin text-stone-500" />
                    <p className="text-xs text-stone-600">Processing...</p>
                  </div>
                ) : creation.status === "failed" ? (
                  <div
                    className={`flex h-full w-full flex-col items-center justify-center px-4 text-center ${
                      userFixableFailure ? "bg-amber-50" : "bg-rose-50"
                    }`}
                  >
                    <GenerationFailureIcon
                      code={failedErrorDisplay?.code || "generation_failed"}
                      className={`mb-2 h-8 w-8 ${
                        userFixableFailure ? "text-amber-600" : "text-rose-600"
                      }`}
                    />
                    <p
                      className={`text-xs font-semibold ${
                        userFixableFailure ? "text-amber-800" : "text-rose-700"
                      }`}
                    >
                      {failedErrorDisplay?.title || "Generation failed"}
                    </p>
                  </div>
                ) : displayUrl ? (
                  <>
                    {creation.type === "image" ? (
                      <CreationImagePreview
                        creation={creation}
                        displayUrl={displayUrl}
                        originalUrl={originalDisplayUrl}
                        hasMultiple={hasMultiple}
                        mediaFailed={mediaFailed}
                        isRefreshingMedia={isRefreshingMedia}
                        onToggleExpand={() => setExpandedTask(isExpanded ? null : key)}
                        onPreview={(url) => setSelectedPreview({ creation, url })}
                        onMediaError={handleMediaError}
                      />
                    ) : creation.type === "video" ? (
                      mediaFailed ? (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-stone-100 px-3 text-center">
                          <Video className="h-8 w-8 text-stone-400" />
                          <p className="mt-2 text-[11px] text-stone-500">
                            Media expired
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="relative h-full w-full cursor-pointer"
                          onClick={() => setSelectedPreview({ creation, url: displayUrl })}
                        >
                          <video
                            src={displayUrl}
                            className="h-full w-full object-contain"
                            muted
                            playsInline
                            preload="metadata"
                            onError={() => handleMediaError(creation, originalDisplayUrl)}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <div className="rounded-full bg-white/90 p-2">
                              <Video className="h-4 w-4 text-stone-900" />
                            </div>
                          </div>
                          {isRefreshingMedia && (
                            <div className="absolute inset-0 flex items-center justify-center bg-stone-100/80">
                              <Loader2 className="h-6 w-6 animate-spin text-stone-500" />
                            </div>
                          )}
                        </button>
                      )
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100">
                        <Music className="h-12 w-12 text-stone-400" />
                      </div>
                    )}
                    {hasMultiple && (
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        +{creation.urls.length - 1}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-stone-50">
                    {creation.type === "image" ? (
                      <ImageIcon className="mb-2 h-8 w-8 text-stone-400" />
                    ) : creation.type === "video" ? (
                      <Video className="mb-2 h-8 w-8 text-stone-400" />
                    ) : (
                      <Music className="mb-2 h-8 w-8 text-stone-400" />
                    )}
                    <p className="px-2 text-center text-[11px] text-stone-500">
                      Media unavailable
                    </p>
                  </div>
                )}

                {/* Hover 操作按钮 */}
                {(creation.status === "success" || creation.status === "failed" || !displayUrl) && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/40 group-hover:opacity-100">
                    {creation.status === "success" && displayUrl && !mediaFailed && creation.type === "image" && (
                      <button
                        onClick={() => setSelectedPreview({ creation, url: displayUrl })}
                        className="rounded-full bg-white/90 p-2 transition-all duration-300 hover:bg-white"
                        title="Preview"
                      >
                        <ImageIcon className="h-4 w-4 text-stone-900" />
                      </button>
                    )}
                    {creation.status === "success" && displayUrl && !mediaFailed && creation.type === "video" && (
                      <button
                        onClick={() => setSelectedPreview({ creation, url: displayUrl })}
                        className="rounded-full bg-white/90 p-2 transition-all duration-300 hover:bg-white"
                        title="Preview"
                      >
                        <Video className="h-4 w-4 text-stone-900" />
                      </button>
                    )}
                    {creation.status === "success" && displayUrl && !mediaFailed && (
                      <button
                        onClick={() => handleDownload(creation, displayUrl)}
                        className="rounded-full bg-white/90 p-2 transition-all duration-300 hover:bg-white"
                        title="Download"
                      >
                        <Download className="h-4 w-4 text-stone-900" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(creation.id)}
                      className="rounded-full bg-white/90 p-2 transition-all duration-300 hover:bg-white"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-stone-900" />
                    </button>
                  </div>
                )}

                {/* 类型标识 */}
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                  {creation.type === "image" ? (
                    <ImageIcon className="h-3 w-3" />
                  ) : creation.type === "video" ? (
                    <Video className="h-3 w-3" />
                  ) : (
                    <Music className="h-3 w-3" />
                  )}
                  <span className="capitalize">{creation.type}</span>
                </div>
              </div>

              {/* 失败状态的操作 */}
              {creation.status === "failed" && (
                <div className={`p-3 ${userFixableFailure ? "bg-amber-50" : "bg-rose-50"}`}>
                  <p
                    className={`mb-1 text-xs font-semibold ${
                      userFixableFailure ? "text-amber-900" : "text-rose-800"
                    }`}
                  >
                    {failedErrorDisplay?.title || "Generation failed"}
                  </p>
                  <p className={`mb-1 text-xs ${userFixableFailure ? "text-amber-800" : "text-rose-700"}`}>
                    {failedErrorDisplay?.message || "Generation failed"}
                  </p>
                  {failedErrorDisplay?.action && (
                    <p className={`mb-3 text-xs ${userFixableFailure ? "text-amber-700" : "text-rose-600"}`}>
                      {failedErrorDisplay.action}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() =>
                        failedErrorDisplay?.code === "insufficient_credits"
                          ? router.push("/pricing")
                          : handleRetry(creation)
                      }
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      {failedErrorDisplay?.code === "insufficient_credits"
                        ? "View plans"
                        : userFixableFailure
                          ? "Edit request"
                          : "Try again"}
                    </Button>
                    <Button
                      onClick={() => handleDelete(creation.id)}
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 展开的任务详情（多图展示） */}
      {expandedTask && (
        <div className="fixed inset-0 z-50 bg-black/80 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={() => setExpandedTask(null)}
              className="absolute right-8 top-8 z-10 rounded-full bg-white/90 p-2 transition-all duration-300 hover:bg-white"
            >
              <X className="h-6 w-6 text-stone-900" />
            </button>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-12">
              {creations
                .find((c) => creationIdentity(c) === expandedTask)
                ?.urls.map((url, idx) => (
                  <div key={idx} className="overflow-hidden rounded-xl border border-stone-200/50 bg-white">
                    <img
                      src={url}
                      alt={`Creation ${idx + 1}`}
                      className="aspect-square w-full cursor-pointer bg-stone-100 object-contain"
                      onClick={() => {
                        const creation = creations.find(
                          (item) => creationIdentity(item) === expandedTask
                        );
                        if (creation) setSelectedPreview({ creation, url });
                      }}
                    />
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {selectedPreview && (
        <CreationPreviewDialog
          creation={selectedPreview.creation}
          mediaUrl={selectedPreview.url}
          onClose={() => setSelectedPreview(null)}
          onRegenerate={() => {
            const creation = selectedPreview.creation;
            setSelectedPreview(null);
            handleRetry(creation);
          }}
          onDownload={() =>
            handleDownload(selectedPreview.creation, selectedPreview.url)
          }
          onDelete={() => {
            const creationId = selectedPreview.creation.id;
            setSelectedPreview(null);
            handleDelete(creationId);
          }}
        />
      )}
      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-stone-200/50 bg-white p-6 shadow-lg shadow-stone-200/20">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-stone-900">
                  Delete creation?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  This will remove the {pendingDeleteCreation?.type || "creation"} from your history.
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setPendingDeleteId(null)}>
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
