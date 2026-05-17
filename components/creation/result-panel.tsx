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
  onGenerateSimilar?: (data: { prompt: string; imageUrl?: string }) => void;
}

export function ResultPanel({ mode, currentGeneration, onGenerateSimilar }: ResultPanelProps) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"explore" | "creations">(
    session ? "creations" : "explore"
  );

  // 登录用户默认看历史，未登录默认 Explore
  useEffect(() => {
    if (!session) {
      setActiveTab("explore");
      return;
    }
    setActiveTab("creations");
  }, [session]);

  // 如果有新的生成任务，切换到 My Creations
  useEffect(() => {
    if (currentGeneration?.taskId && session) {
      setActiveTab("creations");
    }
  }, [currentGeneration?.taskId, session]);

  return (
    <div className="flex h-full flex-col bg-[#FDFDF9]">
      <div className="flex w-full items-center px-6 pb-2 pt-4">
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab("explore")}
            className={`rounded-xl px-2 py-1 text-[10px] font-normal transition-all duration-300 ${
              activeTab === "explore"
                ? "bg-stone-100 text-stone-700"
                : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
            }`}
          >
            Explore
          </button>
          <button
            onClick={() => setActiveTab("creations")}
            className={`rounded-xl px-2 py-1 text-[10px] font-normal transition-all duration-300 ${
              activeTab === "creations"
                ? "bg-stone-100 text-stone-700"
                : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
            }`}
          >
            My Creations
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "explore" ? (
          <ExploreTab mode={mode} onGenerateSimilar={onGenerateSimilar} />
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
