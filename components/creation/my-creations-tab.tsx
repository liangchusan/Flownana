"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Download, Trash2, RefreshCw, Loader2, Image as ImageIcon, Video, Music, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImageModal from "./image-modal";
import VideoModal from "./video-modal";

type CreationStatus = "pending" | "generating" | "processing" | "success" | "failed";

interface Creation {
  id: string;
  type: "image" | "video" | "music";
  status: CreationStatus;
  urls: string[]; // 支持多图
  prompt: string;
  createdAt: string;
  taskId?: string;
  error?: string;
}

const VALID_STATUS: CreationStatus[] = ["pending", "generating", "processing", "success", "failed"];
const LEGACY_STATUS_MAP: Record<string, CreationStatus> = {
  completed: "success",
  done: "success",
  error: "failed",
};

function isCreationStatus(value: unknown): value is CreationStatus {
  return typeof value === "string" && VALID_STATUS.includes(value as CreationStatus);
}

function isValidMediaUrl(url: unknown): url is string {
  return typeof url === "string" && url.trim().length > 0;
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
    ? candidate.urls.filter(isValidMediaUrl)
    : [];
  const urlsFromLegacy = [
    candidate.url,
    candidate.imageUrl,
    candidate.videoUrl,
    candidate.audioUrl,
    candidate.outputUrl,
    candidate.resultUrl,
  ].filter(isValidMediaUrl);
  const urls = [...urlsFromArray, ...urlsFromLegacy].filter(
    (url, index, list) => list.indexOf(url) === index
  );

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
  };
}

function mergeCreations(primary: Creation[], secondary: Creation[]): Creation[] {
  const map = new Map<string, Creation>();
  for (const item of [...primary, ...secondary]) {
    const existed = map.get(item.id);
    if (!existed) {
      map.set(item.id, item);
      continue;
    }
    const pick =
      new Date(item.createdAt).getTime() >= new Date(existed.createdAt).getTime()
        ? item
        : existed;
    map.set(item.id, pick);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

interface MyCreationsTabProps {
  mode: "video" | "image" | "music";
  currentGeneration?: {
    url: string | null;
    isGenerating: boolean;
    taskId?: string;
    prompt?: string;
  };
}

export function MyCreationsTab({ mode, currentGeneration }: MyCreationsTabProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [creations, setCreations] = useState<Creation[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [failedMedia, setFailedMedia] = useState<Set<string>>(new Set());
  const visibleCreations = creations.filter((creation) => creation.type === mode);

  // 优先从后端拉取历史，并兼容迁移老 localStorage 数据
  useEffect(() => {
    if (!session?.user?.id) return;

    const storageKeys = [
      `creations_${session.user.id}`,
      session.user.email ? `creations_${session.user.email}` : null,
    ].filter((item): item is string => !!item);

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
            : [];
          parsedAll.push(...normalized);
        } catch (error) {
          console.error("Error parsing stored creations:", error);
        }
      }
      return mergeCreations(parsedAll, []);
    };

    const localCreations = readLocal();
    if (localCreations.length > 0) {
      setCreations(localCreations);
    }

    fetch(`/api/creations?type=${mode}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const fromApi = Array.isArray(data?.creations)
          ? data.creations
              .map((item: unknown) => normalizeCreation(item))
              .filter((item: Creation | null): item is Creation => !!item)
          : [];
        const merged = mergeCreations(fromApi, localCreations);
        setCreations(merged);
      })
      .catch((error) => {
        console.error("Error fetching creations:", error);
      });
  }, [mode, session]);

  // 处理新的生成任务
  useEffect(() => {
    if (currentGeneration?.taskId && session?.user?.id) {
      const taskId = currentGeneration.taskId;
      setCreations((prev) => {
        // 检查是否已存在
        const exists = prev.find((c) => c.id === taskId);
        if (exists) {
          const updated = prev.map((c) =>
            c.id === taskId
              ? {
                  ...c,
                  status: (currentGeneration.isGenerating ? "generating" : "success") as CreationStatus,
                  urls: currentGeneration.url ? [currentGeneration.url] : c.urls,
                  prompt: currentGeneration.prompt || c.prompt,
                }
              : c
          );
          return updated;
        } else {
          const newCreation: Creation = {
            id: taskId,
            type: mode,
            status: (currentGeneration.isGenerating ? "generating" : "success") as CreationStatus,
            urls: currentGeneration.url ? [currentGeneration.url] : [],
            prompt: currentGeneration.prompt || "",
            createdAt: new Date().toISOString(),
            taskId: taskId,
          };
          return [newCreation, ...prev];
        }
      });
    }
  }, [currentGeneration, mode, session]);

  // 保存到 localStorage
  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    const storageKey = `creations_${session.user.id}`;

    if (creations.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(creations));
      return;
    }

    localStorage.removeItem(storageKey);
  }, [creations, session]);

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this creation?")) {
      setCreations((prev) => prev.filter((c) => c.id !== id));
      setFailedMedia((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetch(`/api/creations?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }).catch((error) => {
        console.error("Error deleting creation:", error);
      });
    }
  };

  const handleRetry = (creation: Creation) => {
    const params = new URLSearchParams();

    if (creation.prompt.trim()) {
      params.set("prompt", creation.prompt);
    }

    if (creation.type !== "music" && creation.urls[0]) {
      params.set("image", creation.urls[0]);
    }

    const basePath =
      creation.type === "image"
        ? "/ai-image"
        : creation.type === "video"
          ? "/ai-video"
          : "/ai-music";

    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  };

  const handleDownload = (url: string, type: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `flownana-${type}-${Date.now()}.${type === "image" ? "png" : type === "video" ? "mp4" : "mp3"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 空状态
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
          const isExpanded = expandedTask === creation.id;
          const displayUrl = creation.urls[0];
          const hasMultiple = creation.urls.length > 1;
          const mediaFailed = failedMedia.has(creation.id);

          return (
            <div
              key={creation.id}
              className="group relative overflow-hidden rounded-xl border border-stone-200/50 bg-white shadow-sm transition-all duration-300 hover:shadow-md"
            >
              {/* 封面 */}
              <div className="relative aspect-video bg-stone-100">
                {creation.status === "pending" || creation.status === "generating" ? (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-stone-50">
                    <Loader2 className="mb-2 h-8 w-8 animate-spin text-stone-500" />
                    <p className="text-xs text-stone-600">
                      {creation.status === "pending" ? "Queued" : "Generating..."}
                    </p>
                  </div>
                ) : creation.status === "processing" ? (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-stone-50 opacity-50">
                    <Loader2 className="mb-2 h-8 w-8 animate-spin text-stone-500" />
                    <p className="text-xs text-stone-600">Processing...</p>
                  </div>
                ) : creation.status === "failed" ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-red-50">
                    <X className="h-8 w-8 text-red-500 mb-2" />
                    <p className="text-xs text-red-600">Failed</p>
                  </div>
                ) : displayUrl ? (
                  <>
                    {creation.type === "image" ? (
                      mediaFailed ? (
                        <div className="flex h-full w-full items-center justify-center bg-stone-100">
                          <ImageIcon className="h-8 w-8 text-stone-400" />
                        </div>
                      ) : (
                        <img
                          src={displayUrl}
                          alt={creation.prompt}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => {
                            if (hasMultiple) {
                              setExpandedTask(isExpanded ? null : creation.id);
                            } else {
                              setSelectedImage(displayUrl);
                            }
                          }}
                          onError={() =>
                            setFailedMedia((prev) => new Set(prev).add(creation.id))
                          }
                          loading="lazy"
                        />
                      )
                    ) : creation.type === "video" ? (
                      mediaFailed ? (
                        <div className="flex h-full w-full items-center justify-center bg-stone-100">
                          <Video className="h-8 w-8 text-stone-400" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="relative h-full w-full cursor-pointer"
                          onClick={() => setSelectedVideo(displayUrl)}
                        >
                          <video
                            src={displayUrl}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                            onError={() =>
                              setFailedMedia((prev) => new Set(prev).add(creation.id))
                            }
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <div className="rounded-full bg-white/90 p-2">
                              <Video className="h-4 w-4 text-stone-900" />
                            </div>
                          </div>
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
                {creation.status === "success" && displayUrl && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/40 group-hover:opacity-100">
                    {creation.type === "image" && (
                      <button
                        onClick={() => setSelectedImage(displayUrl)}
                        className="rounded-full bg-white/90 p-2 transition-all duration-300 hover:bg-white"
                        title="Preview"
                      >
                        <ImageIcon className="h-4 w-4 text-stone-900" />
                      </button>
                    )}
                    {creation.type === "video" && (
                      <button
                        onClick={() => setSelectedVideo(displayUrl)}
                        className="rounded-full bg-white/90 p-2 transition-all duration-300 hover:bg-white"
                        title="Preview"
                      >
                        <Video className="h-4 w-4 text-stone-900" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(displayUrl, creation.type)}
                      className="rounded-full bg-white/90 p-2 transition-all duration-300 hover:bg-white"
                      title="Download"
                    >
                      <Download className="h-4 w-4 text-stone-900" />
                    </button>
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
                <div className="p-3 bg-red-50">
                  <p className="text-xs text-red-600 mb-2">{creation.error || "Generation failed"}</p>
                  <Button
                    onClick={() => handleRetry(creation)}
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
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
                .find((c) => c.id === expandedTask)
                ?.urls.map((url, idx) => (
                  <div key={idx} className="overflow-hidden rounded-xl border border-stone-200/50 bg-white">
                    <img
                      src={url}
                      alt={`Creation ${idx + 1}`}
                      className="w-full aspect-square object-cover cursor-pointer"
                      onClick={() => setSelectedImage(url)}
                    />
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 图片预览 Modal */}
      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
      {selectedVideo && (
        <VideoModal
          videoUrl={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}
