"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, SlidersHorizontal } from "lucide-react";
import axios from "axios";
import { useToast } from "@/components/blocks/app-toast-provider";
import type { GenerationParameters } from "@/lib/creation-history";

interface VoiceCreationFormProps {
  onGenerate: (audioUrl: string, taskId?: string, prompt?: string, optimisticId?: string) => void;
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
  onTaskIdChange?: (taskId: string) => void;
  initialPrompt?: string;
  initialParameters?: GenerationParameters;
  variant?: "panel" | "composer";
  onGenerationStart?: (data: {
    optimisticId: string;
    prompt: string;
    parameters: GenerationParameters;
  }) => void;
  onGenerationFailure?: (data: {
    optimisticId: string;
    prompt: string;
    error: string;
  }) => void;
}

export function VoiceCreationForm({
  onGenerate,
  isGenerating,
  setIsGenerating,
  onTaskIdChange,
  initialPrompt,
  variant = "panel",
  onGenerationStart,
  onGenerationFailure,
}: VoiceCreationFormProps) {
  const { showToast } = useToast();
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [makeInstrumental, setMakeInstrumental] = useState(false);

  useEffect(() => {
    if (initialPrompt !== undefined) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showToast({
        title: "Prompt required",
        message: "Please enter a prompt",
        variant: "warning",
      });
      return;
    }

    const requestPrompt = prompt.trim();
    const requestTitle = title;
    const requestTags = tags;
    const requestInstrumental = makeInstrumental;
    const optimisticId = `local-music-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    onGenerationStart?.({
      optimisticId,
      prompt: requestPrompt,
      parameters: { model: "Suno", mode: requestInstrumental ? "Instrumental" : "Music" },
    });
    setPrompt("");
    setTitle("");
    setTags("");
    setIsGenerating(true);
    try {
      const response = await axios.post("/api/suno/generate", {
        prompt: requestPrompt,
        title: requestTitle || undefined,
        tags: requestTags || undefined,
        makeInstrumental: requestInstrumental,
        runId: optimisticId,
      });

      if (response.data.success) {
        const taskId = response.data.taskId || response.data.id; // Suno API 可能使用 id
        const responsePrompt = response.data.prompt || requestPrompt;
        if (taskId && onTaskIdChange) {
          onTaskIdChange(taskId);
        }
        onGenerate(response.data.audioUrl, taskId, responsePrompt, optimisticId);
      } else {
        showToast({
          title: "Generation failed",
          message: "Generation failed, please try again",
          variant: "error",
        });
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      onGenerationFailure?.({
        optimisticId,
        prompt: requestPrompt,
        error: error.response?.data?.error || "Generation failed, please try again",
      });
      showToast({
        title: "Generation failed",
        message: error.response?.data?.error || "Generation failed, please try again",
        variant: "error",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (variant === "composer") {
    return (
      <div className="space-y-3">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe the music or sound you want to create..."
          className="min-h-20 w-full resize-none border-0 bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          maxLength={500}
        />
        <details className="group border-t border-border pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted-foreground transition-all duration-300 hover:text-foreground">
            <SlidersHorizontal className="h-4 w-4" /> Music settings
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title (optional)" className="h-9 rounded-ui border border-border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-primary/30" />
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags (optional)" className="h-9 rounded-ui border border-border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-primary/30" />
            <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
              <input type="checkbox" checked={makeInstrumental} onChange={(event) => setMakeInstrumental(event.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
              Instrumental only
            </label>
          </div>
        </details>
        <div className="flex justify-end border-t border-border pt-3">
          <Button type="button" onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className="h-10 gap-2 px-4">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>10 credits</span><Send className="h-4 w-4" /></>}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Prompt Input */}
      <div>
        <label className="mb-2 block text-sm font-medium text-stone-700">
          Prompt <span className="text-stone-500">({prompt.length}/500)</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the music or voice you want to generate..."
          className="h-32 w-full resize-none rounded-xl border border-stone-200/50 px-4 py-3 text-stone-900 transition-all duration-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-500"
          maxLength={500}
        />
      </div>

      {/* Optional Settings */}
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-stone-700">
            Title (Optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for your audio"
            className="w-full rounded-xl border border-stone-200/50 px-4 py-2 text-stone-900 transition-all duration-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-stone-700">
            Tags (Optional)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="rock, pop, electronic, etc."
            className="w-full rounded-xl border border-stone-200/50 px-4 py-2 text-stone-900 transition-all duration-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-500"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="instrumental"
            checked={makeInstrumental}
            onChange={(e) => setMakeInstrumental(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-stone-800 focus:ring-stone-500"
          />
          <label htmlFor="instrumental" className="ml-2 text-sm text-stone-700">
            Make instrumental (no vocals)
          </label>
        </div>
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim()}
        className="w-full rounded-xl border-0 bg-stone-800 text-white shadow-sm transition-all duration-300 hover:bg-stone-800/90 active:scale-[0.98] disabled:opacity-50"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          "Generate"
        )}
      </Button>

      <p className="text-xs text-stone-600">
        This generation will cost 10 credits.
      </p>
    </div>
  );
}
