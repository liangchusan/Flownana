"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import axios from "axios";

interface VoiceCreationFormProps {
  onGenerate: (audioUrl: string, taskId?: string, prompt?: string) => void;
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
  onTaskIdChange?: (taskId: string) => void;
  initialPrompt?: string;
}

export function VoiceCreationForm({
  onGenerate,
  isGenerating,
  setIsGenerating,
  onTaskIdChange,
  initialPrompt,
}: VoiceCreationFormProps) {
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
      alert("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await axios.post("/api/suno/generate", {
        prompt,
        title: title || undefined,
        tags: tags || undefined,
        makeInstrumental,
      });

      if (response.data.success) {
        const taskId = response.data.taskId || response.data.id; // Suno API 可能使用 id
        const responsePrompt = response.data.prompt || prompt;
        if (taskId && onTaskIdChange) {
          onTaskIdChange(taskId);
        }
        onGenerate(response.data.audioUrl, taskId, responsePrompt);
      } else {
        alert("Generation failed, please try again");
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      alert(error.response?.data?.error || "Generation failed, please try again");
    } finally {
      setIsGenerating(false);
    }
  };

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
