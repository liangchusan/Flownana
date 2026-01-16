"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Music } from "lucide-react";
import axios from "axios";

interface VoiceCreationFormProps {
  onGenerate: (audioUrl: string, taskId?: string, prompt?: string) => void;
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
  onTaskIdChange?: (taskId: string) => void;
}

export function VoiceCreationForm({
  onGenerate,
  isGenerating,
  setIsGenerating,
  onTaskIdChange,
}: VoiceCreationFormProps) {
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [makeInstrumental, setMakeInstrumental] = useState(false);

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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Prompt <span className="text-gray-500">({prompt.length}/500)</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the music or voice you want to generate..."
          className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          maxLength={500}
        />
      </div>

      {/* Optional Settings */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title (Optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for your audio"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags (Optional)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="rock, pop, electronic, etc."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="instrumental"
            checked={makeInstrumental}
            onChange={(e) => setMakeInstrumental(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="instrumental" className="ml-2 text-sm text-gray-700">
            Make instrumental (no vocals)
          </label>
        </div>
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim()}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Music className="h-5 w-5 mr-2" />
            Generate Audio
          </>
        )}
      </Button>
    </div>
  );
}

