"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CreationSidebar } from "@/components/layout/creation-sidebar";
import { GenerateForm } from "@/components/generate/generate-form";
import { ResultPanel } from "@/components/creation/result-panel";
import type { CreationHistoryItem } from "@/lib/creation-history";

export function CreateContent({
  mode,
  initialCreations = [],
}: {
  mode: "image";
  initialCreations?: CreationHistoryItem[];
}) {
  const searchParams = useSearchParams();

  // Image state
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | undefined>(undefined);
  const [currentPrompt, setCurrentPrompt] = useState<string | undefined>(undefined);
  const [similarPrompt, setSimilarPrompt] = useState<string | undefined>(undefined);
  const [similarImage, setSimilarImage] = useState<string | undefined>(undefined);

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
      <main className="ml-[60px] flex-1 overflow-y-auto bg-[#FDFDF9]">
        <div className="flex h-screen">
          {/* Left: Creation Form */}
          <div className="w-full max-w-lg shrink-0 overflow-y-auto border-r border-stone-200/50 bg-[#FDFDF9] p-8">
            <h1 className="mb-8 text-3xl font-bold text-stone-900 md:text-4xl">
              AI Image
            </h1>
            <GenerateForm
              onGenerate={(url, taskId, prompt) => {
                setGeneratedImage(url);
                if (taskId) setCurrentTaskId(taskId);
                if (prompt) setCurrentPrompt(prompt);
              }}
              isGenerating={isGeneratingImage}
              setIsGenerating={setIsGeneratingImage}
              onTaskIdChange={setCurrentTaskId}
              initialPrompt={similarPrompt}
              initialImage={similarImage}
            />
          </div>

          {/* Right: Result Panel */}
          <div className="flex-1 overflow-hidden bg-[#FDFDF9]">
            <ResultPanel
              mode="image"
              initialCreations={initialCreations}
              currentGeneration={{
                url: generatedImage,
                isGenerating: isGeneratingImage,
                taskId: currentTaskId,
                prompt: currentPrompt,
              }}
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
