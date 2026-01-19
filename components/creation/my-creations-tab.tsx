"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Download, Trash2, RefreshCw, Loader2, Image, Video, Music, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImageModal from "./image-modal";

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
  const [creations, setCreations] = useState<Creation[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // 从 localStorage 加载历史记录
  useEffect(() => {
    if (session?.user?.email) {
      const stored = localStorage.getItem(`creations_${session.user.email}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCreations(parsed);
        } catch (error) {
          console.error("Error parsing stored creations:", error);
        }
      }
    }
  }, [session]);

  // 处理新的生成任务
  useEffect(() => {
    if (currentGeneration?.taskId && session?.user?.email) {
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
    if (session?.user?.email && creations.length > 0) {
      localStorage.setItem(`creations_${session.user.email}`, JSON.stringify(creations));
    }
  }, [creations, session]);

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this creation?")) {
      setCreations((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleRetry = (creation: Creation) => {
    // TODO: 实现重试逻辑
    console.log("Retry creation:", creation);
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
          <div className="text-gray-400 mb-4">
            {mode === "video" ? (
              <Video className="h-16 w-16 mx-auto" />
            ) : mode === "image" ? (
              <Image className="h-16 w-16 mx-auto" />
            ) : (
              <Music className="h-16 w-16 mx-auto" />
            )}
          </div>
          <p className="text-gray-600 text-lg font-medium mb-2">
            Sign in to view your creations
          </p>
          <p className="text-gray-500 text-sm">
            Your generated content will appear here
          </p>
        </div>
      </div>
    );
  }

  if (creations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            {mode === "video" ? (
              <Video className="h-16 w-16 mx-auto" />
            ) : mode === "image" ? (
              <Image className="h-16 w-16 mx-auto" />
            ) : (
              <Music className="h-16 w-16 mx-auto" />
            )}
          </div>
          <p className="text-gray-600 text-lg font-medium mb-2">
            You haven't created anything yet
          </p>
          <p className="text-gray-500 text-sm">
            Start generating to see your creations here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {creations.map((creation) => {
          const isExpanded = expandedTask === creation.id;
          const displayUrl = creation.urls[0];
          const hasMultiple = creation.urls.length > 1;

          return (
            <div
              key={creation.id}
              className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {/* 封面 */}
              <div className="aspect-video bg-gray-100 relative">
                {creation.status === "pending" || creation.status === "generating" ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
                    <p className="text-xs text-gray-600">
                      {creation.status === "pending" ? "Queued" : "Generating..."}
                    </p>
                  </div>
                ) : creation.status === "processing" ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 opacity-50">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
                    <p className="text-xs text-gray-600">Processing...</p>
                  </div>
                ) : creation.status === "failed" ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-red-50">
                    <X className="h-8 w-8 text-red-500 mb-2" />
                    <p className="text-xs text-red-600">Failed</p>
                  </div>
                ) : displayUrl ? (
                  <>
                    {creation.type === "image" ? (
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
                        loading="lazy"
                      />
                    ) : creation.type === "video" ? (
                      <video
                        src={displayUrl}
                        className="w-full h-full object-cover"
                        controls
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                        <Music className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                    {hasMultiple && (
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        +{creation.urls.length - 1}
                      </div>
                    )}
                  </>
                ) : null}

                {/* Hover 操作按钮 */}
                {creation.status === "success" && displayUrl && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    {creation.type === "image" && (
                      <button
                        onClick={() => setSelectedImage(displayUrl)}
                        className="bg-white/90 hover:bg-white rounded-full p-2 transition-colors"
                        title="Preview"
                      >
                        <Image className="h-4 w-4 text-gray-900" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(displayUrl, creation.type)}
                      className="bg-white/90 hover:bg-white rounded-full p-2 transition-colors"
                      title="Download"
                    >
                      <Download className="h-4 w-4 text-gray-900" />
                    </button>
                    <button
                      onClick={() => handleDelete(creation.id)}
                      className="bg-white/90 hover:bg-white rounded-full p-2 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-gray-900" />
                    </button>
                  </div>
                )}

                {/* 类型标识 */}
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                  {creation.type === "image" ? (
                    <Image className="h-3 w-3" />
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
              className="absolute top-8 right-8 bg-white/90 hover:bg-white rounded-full p-2 transition-colors z-10"
            >
              <X className="h-6 w-6 text-gray-900" />
            </button>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-12">
              {creations
                .find((c) => c.id === expandedTask)
                ?.urls.map((url, idx) => (
                  <div key={idx} className="bg-white rounded-lg overflow-hidden">
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
    </div>
  );
}
