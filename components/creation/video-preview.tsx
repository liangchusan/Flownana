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
    <div className="w-full h-full flex flex-col items-center justify-center space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Generated Video</h2>
      
      {isGenerating ? (
        <div className="flex flex-col items-center justify-center w-full max-w-4xl aspect-video bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
          <Loader2 className="h-16 w-16 text-blue-500 animate-spin mb-6" />
          <p className="text-gray-700 text-lg font-medium">Generating video, please wait...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a few minutes</p>
        </div>
      ) : videoUrl ? (
        <div className="w-full max-w-4xl space-y-6">
          <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden shadow-lg">
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
        <div className="flex flex-col items-center justify-center w-full max-w-4xl aspect-video bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
          <div className="text-center">
            <Video className="h-20 w-20 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-xl font-medium mb-2">Ready to Create</p>
            <p className="text-gray-500 text-sm">
              Enter a prompt and generate your video
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

