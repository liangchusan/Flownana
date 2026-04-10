"use client";

import { Download, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoPreviewProps {
  videoUrl: string | null;
  isGenerating: boolean;
}

export function VideoPreview({ videoUrl, isGenerating }: VideoPreviewProps) {
  const handleDownload = () => {
    if (videoUrl) {
      const link = document.createElement("a");
      link.href = videoUrl;
      link.download = `flownana-video-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center space-y-6">
      <h2 className="text-2xl font-bold text-stone-900">Generated Video</h2>
      
      {isGenerating ? (
        <div className="flex aspect-video w-full max-w-4xl flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-gradient-to-br from-stone-50 to-zinc-100">
          <Loader2 className="mb-6 h-16 w-16 animate-spin text-stone-500" />
          <p className="text-lg font-medium text-stone-700">Generating video, please wait...</p>
          <p className="mt-2 text-sm text-stone-500">This may take a few minutes</p>
        </div>
      ) : videoUrl ? (
        <div className="w-full max-w-4xl space-y-6">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-stone-100 shadow-lg">
            <video
              src={videoUrl}
              controls
              className="w-full h-full object-contain"
            />
          </div>
          <Button
            onClick={handleDownload}
            className="w-full py-6 text-base font-medium"
            variant="outline"
          >
            <Download className="h-5 w-5 mr-2" />
            Download Video
          </Button>
        </div>
      ) : (
        <div className="flex aspect-video w-full max-w-4xl flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-gradient-to-br from-stone-50 to-zinc-100">
          <div className="text-center">
            <Video className="mx-auto mb-4 h-20 w-20 text-stone-400" />
            <p className="mb-2 text-xl font-medium text-stone-600">Ready to Create</p>
            <p className="text-sm text-stone-500">
              Enter a prompt and generate your video
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

