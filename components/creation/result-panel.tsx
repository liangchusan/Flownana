"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { ExploreTab } from "./explore-tab";
import { MyCreationsTab } from "./my-creations-tab";
import type {
  CreationHistoryItem,
  GenerationParameters,
} from "@/lib/creation-history";

interface ResultPanelProps {
  initialAccountScope?: string | null;
  mode: "video" | "image" | "music";
  initialCreations?: CreationHistoryItem[];
  currentGeneration?: PanelGeneration;
  currentGenerations?: PanelGeneration[];
  onGenerateSimilar?: (data: { prompt: string; imageUrl?: string }) => void;
}

export interface PanelGeneration {
  url: string | null;
  inputUrls?: string[];
  isGenerating: boolean;
  taskId?: string;
  optimisticId?: string;
  prompt?: string;
  error?: string;
  errorCode?: string;
  parameters?: GenerationParameters;
}

export function ResultPanel({
  initialAccountScope,
  mode,
  initialCreations = [],
  currentGeneration,
  currentGenerations,
  onGenerateSimilar,
}: ResultPanelProps) {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<"explore" | "creations">("creations");
  const generationItems = useMemo(
    () => currentGenerations ?? (currentGeneration ? [currentGeneration] : []),
    [currentGeneration, currentGenerations]
  );

  // 登录用户默认看历史，未登录默认 Explore
  useEffect(() => {
    if (status === "loading") {
      return;
    }
    if (!session) {
      setActiveTab("explore");
      return;
    }
    setActiveTab("creations");
  }, [session, status]);

  // 如果有新的生成任务，切换到 My Creations
  useEffect(() => {
    if (
      generationItems.some((generation) => generation.taskId || generation.optimisticId) &&
      session
    ) {
      setActiveTab("creations");
    }
  }, [generationItems, session]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex w-full items-center px-6 pb-2 pt-4">
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab("explore")}
            className={`rounded-xl px-2 py-1 text-[10px] font-normal transition-all duration-300 ${
              activeTab === "explore"
                ? "bg-surface-soft text-foreground"
                : "text-muted-foreground hover:bg-surface-soft hover:text-foreground"
            }`}
          >
            Explore
          </button>
          <button
            onClick={() => setActiveTab("creations")}
            className={`rounded-xl px-2 py-1 text-[10px] font-normal transition-all duration-300 ${
              activeTab === "creations"
                ? "bg-surface-soft text-foreground"
                : "text-muted-foreground hover:bg-surface-soft hover:text-foreground"
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
            initialAccountScope={initialAccountScope}
            mode={mode}
            initialCreations={initialCreations}
            currentGenerations={generationItems}
          />
        )}
      </div>
    </div>
  );
}
