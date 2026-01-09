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
    <div className="w-full h-full flex flex-col items-center justify-center space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Generated Audio</h2>
      
      {isGenerating ? (
        <div className="flex flex-col items-center justify-center w-full max-w-2xl aspect-video bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
          <Loader2 className="h-16 w-16 text-green-500 animate-spin mb-6" />
          <p className="text-gray-700 text-lg font-medium">Generating audio, please wait...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a few minutes</p>
        </div>
      ) : audioUrl ? (
        <div className="w-full max-w-2xl space-y-6">
          <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-12 shadow-lg">
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
        <div className="flex flex-col items-center justify-center w-full max-w-2xl aspect-video bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
          <div className="text-center">
            <Mic className="h-20 w-20 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-xl font-medium mb-2">Ready to Create</p>
            <p className="text-gray-500 text-sm">
              Enter a prompt and generate your audio
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

