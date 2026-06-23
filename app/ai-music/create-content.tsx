"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CreationSidebar } from "@/components/layout/creation-sidebar";
import { VoiceCreationForm } from "@/components/creation/voice-creation-form";
import { ResultPanel } from "@/components/creation/result-panel";
import type { CreationHistoryItem } from "@/lib/creation-history";

export function CreateContent({
  mode,
  initialCreations = [],
}: {
  mode: "voice";
  initialCreations?: CreationHistoryItem[];
}) {
  const searchParams = useSearchParams();
  
  // Voice state
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | undefined>(undefined);
  const [currentPrompt, setCurrentPrompt] = useState<string | undefined>(undefined);
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined);

  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (prompt) {
      setInitialPrompt(decodeURIComponent(prompt));
    }
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
              AI Music
            </h1>
            <VoiceCreationForm
              onGenerate={(url, taskId, prompt) => {
                setGeneratedAudio(url);
                if (taskId) setCurrentTaskId(taskId);
                if (prompt) setCurrentPrompt(prompt);
              }}
              isGenerating={isGeneratingVoice}
              setIsGenerating={setIsGeneratingVoice}
              onTaskIdChange={setCurrentTaskId}
              initialPrompt={initialPrompt}
            />
          </div>

          {/* Right: Result Panel */}
          <div className="flex-1 overflow-hidden bg-[#FDFDF9]">
            <ResultPanel
              mode="music"
              initialCreations={initialCreations}
              currentGeneration={{
                url: generatedAudio,
                isGenerating: isGeneratingVoice,
                taskId: currentTaskId,
                prompt: currentPrompt,
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
