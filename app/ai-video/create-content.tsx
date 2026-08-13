"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CreationSidebar } from "@/components/layout/creation-sidebar";
import { VideoCreationForm } from "@/components/creation/video-creation-form";
import { ResultPanel } from "@/components/creation/result-panel";
import type { PanelGeneration } from "@/components/creation/result-panel";
import type { CreationHistoryItem } from "@/lib/creation-history";

export function CreateContent({
  mode,
  initialCreations = [],
}: {
  mode: "video";
  initialCreations?: CreationHistoryItem[];
}) {
  const searchParams = useSearchParams();

  // Video state
  const [videoGenerations, setVideoGenerations] = useState<PanelGeneration[]>([]);
  const [similarPrompt, setSimilarPrompt] = useState<string | undefined>(undefined);
  const [similarImage, setSimilarImage] = useState<string | undefined>(undefined);
  const activeVideoGenerationCount = videoGenerations.filter(
    (generation) => generation.isGenerating && !generation.url && !generation.error
  ).length;

  // Sync initial prompt/image from URL (?prompt=... & ?image=...)
  useEffect(() => {
    const q = searchParams.get("prompt");
    const img = searchParams.get("image");
    if (q) setSimilarPrompt(decodeURIComponent(q));
    if (img) setSimilarImage(decodeURIComponent(img));
  }, [searchParams]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <CreationSidebar />

      {/* Main Content Area */}
      <main className="ml-[60px] flex-1 overflow-y-auto bg-background">
        <div className="flex h-screen">
          {/* Left: Creation Form */}
          <div className="w-full max-w-lg shrink-0 overflow-y-auto border-r border-border bg-background p-8">
            <h1 className="mb-8 text-3xl font-bold text-stone-900 md:text-4xl">
              AI Video
            </h1>
            <VideoCreationForm
              onGenerationStart={({ optimisticId, prompt, parameters }) => {
                setVideoGenerations((prev) => [
                  {
                    url: null,
                    isGenerating: true,
                    optimisticId,
                    prompt,
                    parameters,
                  },
                  ...prev,
                ]);
              }}
              onGenerate={(url, taskId, prompt, optimisticId, parameters, inputUrls) => {
                setVideoGenerations((prev) =>
                  prev.map((generation) =>
                    generation.optimisticId === optimisticId
                      ? {
                          ...generation,
                          url,
                          isGenerating: false,
                          taskId,
                          prompt: prompt || generation.prompt,
                          parameters: parameters || generation.parameters,
                          inputUrls: inputUrls || generation.inputUrls,
                          error: undefined,
                        }
                      : generation
                  )
                );
              }}
              onGenerationTaskCreated={({ optimisticId, taskId, prompt, inputUrls }) => {
                setVideoGenerations((prev) =>
                  prev.map((generation) =>
                    generation.optimisticId === optimisticId
                      ? {
                          ...generation,
                          taskId,
                          prompt: prompt || generation.prompt,
                          inputUrls: inputUrls || generation.inputUrls,
                        }
                      : generation
                  )
                );
              }}
              onGenerationFailure={({ optimisticId, prompt, error, errorCode }) => {
                setVideoGenerations((prev) =>
                  prev.map((generation) =>
                    generation.optimisticId === optimisticId
                      ? {
                          ...generation,
                          url: null,
                          isGenerating: false,
                          prompt,
                          error,
                          errorCode,
                        }
                      : generation
                  )
                );
              }}
              activeGenerationCount={activeVideoGenerationCount}
              initialPrompt={similarPrompt}
              initialImage={similarImage}
            />
          </div>

          {/* Right: Result Panel */}
          <div className="flex-1 overflow-hidden bg-background">
            <ResultPanel
              mode="video"
              initialCreations={initialCreations}
              currentGenerations={videoGenerations}
              onGenerateSimilar={(data) => {
                setSimilarPrompt(data.prompt);
                setSimilarImage(data.imageUrl);
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
