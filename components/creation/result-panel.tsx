"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ExploreTab } from "./explore-tab";
import { MyCreationsTab } from "./my-creations-tab";

interface ResultPanelProps {
  mode: "video" | "image" | "music";
  currentGeneration?: {
    url: string | null;
    isGenerating: boolean;
    taskId?: string;
    prompt?: string;
  };
}

export function ResultPanel({ mode, currentGeneration }: ResultPanelProps) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"explore" | "creations">("explore");
  const [hasHistory, setHasHistory] = useState(false);

  // 根据规则确定默认 Tab
  useEffect(() => {
    // 如果未登录，默认 Explore
    if (!session) {
      setActiveTab("explore");
      return;
    }

    // 如果已登录，检查是否有历史记录
    // TODO: 实际应该调用 API 检查
    // 暂时先检查是否有本地存储的历史记录
    const checkHistory = async () => {
      try {
        // 这里应该调用 API 检查是否有历史记录
        // 暂时使用模拟逻辑
        const history = localStorage.getItem(`creations_${session.user?.email}`);
        if (history) {
          const parsed = JSON.parse(history);
          setHasHistory(parsed.length > 0);
          if (parsed.length > 0) {
            setActiveTab("creations");
          }
        }
      } catch (error) {
        console.error("Error checking history:", error);
      }
    };

    checkHistory();
  }, [session]);

  // 如果有新的生成任务，切换到 My Creations
  useEffect(() => {
    if (currentGeneration?.taskId && session) {
      setActiveTab("creations");
    }
  }, [currentGeneration?.taskId, session]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Small Tab Buttons - Full Width, Subtle */}
      <div className="w-full px-6 pt-4 pb-2 flex gap-3">
        <button
          onClick={() => setActiveTab("explore")}
          className={`px-2 py-1 text-[10px] font-normal rounded transition-colors ${
            activeTab === "explore"
              ? "text-blue-600 bg-blue-50"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          Explore
        </button>
        <button
          onClick={() => setActiveTab("creations")}
          className={`px-2 py-1 text-[10px] font-normal rounded transition-colors ${
            activeTab === "creations"
              ? "text-blue-600 bg-blue-50"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          My Creations
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "explore" ? (
          <ExploreTab mode={mode} />
        ) : (
          <MyCreationsTab
            mode={mode}
            currentGeneration={currentGeneration}
          />
        )}
      </div>
    </div>
  );
}
