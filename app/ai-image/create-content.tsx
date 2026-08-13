"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CreationSidebar } from "@/components/layout/creation-sidebar";
import { GenerateForm } from "@/components/generate/generate-form";
import { ResultPanel } from "@/components/creation/result-panel";
import type { PanelGeneration } from "@/components/creation/result-panel";
import type {
  CreationHistoryItem,
} from "@/lib/creation-history";

export function CreateContent({
  mode,
  initialCreations = [],
}: {
  mode: "image";
  initialCreations?: CreationHistoryItem[];
}) {
  const searchParams = useSearchParams();

  const [imageGenerations, setImageGenerations] = useState<PanelGeneration[]>([]);
  const [similarPrompt, setSimilarPrompt] = useState<string | undefined>(undefined);
  const [similarImage, setSimilarImage] = useState<string | undefined>(undefined);
  const activeImageGenerationCount = imageGenerations.filter(
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
        <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row">
          {/* Left: Creation Form */}
          <div className="w-full shrink-0 border-b border-border bg-background p-6 lg:max-w-lg lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-8">
            <h1 className="mb-8 font-display text-3xl font-medium text-foreground md:text-display-md">
              AI Image
            </h1>
            <GenerateForm
              onGenerationStart={({ optimisticId, prompt, parameters }) => {
                setImageGenerations((prev) => [
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
              onGenerate={(url, taskId, prompt, parameters, optimisticId, inputUrls) => {
                setImageGenerations((prev) =>
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
              onGenerationTaskCreated={({ optimisticId, taskId, prompt }) => {
                setImageGenerations((prev) =>
                  prev.map((generation) =>
                    generation.optimisticId === optimisticId
                      ? {
                          ...generation,
                          taskId,
                          prompt: prompt || generation.prompt,
                        }
                      : generation
                  )
                );
              }}
              onGenerationFailure={({ optimisticId, prompt, error, errorCode }) => {
                setImageGenerations((prev) =>
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
              isGenerating={activeImageGenerationCount >= 5}
              setIsGenerating={() => undefined}
              activeGenerationCount={activeImageGenerationCount}
              initialPrompt={similarPrompt}
              initialImage={similarImage}
            />
          </div>

          {/* Right: Result Panel */}
          <div className="min-h-[70vh] flex-1 overflow-hidden bg-background lg:min-h-0">
            <ResultPanel
              mode="image"
              initialCreations={initialCreations}
              currentGenerations={imageGenerations}
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
