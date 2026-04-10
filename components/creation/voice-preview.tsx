"use client";

import { Download, Loader2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoicePreviewProps {
  audioUrl: string | null;
  isGenerating: boolean;
}

export function VoicePreview({ audioUrl, isGenerating }: VoicePreviewProps) {
  const handleDownload = () => {
    if (audioUrl) {
      const link = document.createElement("a");
      link.href = audioUrl;
      link.download = `flownana-audio-${Date.now()}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center space-y-6">
      <h2 className="text-2xl font-bold text-stone-900">Generated Audio</h2>
      
      {isGenerating ? (
        <div className="flex aspect-video w-full max-w-2xl flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-gradient-to-br from-stone-50 to-zinc-100">
          <Loader2 className="mb-6 h-16 w-16 animate-spin text-stone-500" />
          <p className="text-lg font-medium text-stone-700">Generating audio, please wait...</p>
          <p className="mt-2 text-sm text-stone-500">This may take a few minutes</p>
        </div>
      ) : audioUrl ? (
        <div className="w-full max-w-2xl space-y-6">
          <div className="relative rounded-xl bg-gradient-to-br from-stone-50 to-zinc-100 p-12 shadow-lg">
            <audio
              src={audioUrl}
              controls
              className="w-full"
            />
          </div>
          <Button
            onClick={handleDownload}
            className="w-full py-6 text-base font-medium"
            variant="outline"
          >
            <Download className="h-5 w-5 mr-2" />
            Download Audio
          </Button>
        </div>
      ) : (
        <div className="flex aspect-video w-full max-w-2xl flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-gradient-to-br from-stone-50 to-zinc-100">
          <div className="text-center">
            <Mic className="mx-auto mb-4 h-20 w-20 text-stone-400" />
            <p className="mb-2 text-xl font-medium text-stone-600">Ready to Create</p>
            <p className="text-sm text-stone-500">
              Enter a prompt and generate your audio
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

