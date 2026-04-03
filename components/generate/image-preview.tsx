"use client";

import { Download, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImagePreviewProps {
  imageUrl: string | null;
  isGenerating: boolean;
}

export function ImagePreview({ imageUrl, isGenerating }: ImagePreviewProps) {
  const handleDownload = () => {
    if (imageUrl) {
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `nano-banana-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Generated Result</h2>
      
      {isGenerating ? (
        <div className="flex flex-col items-center justify-center w-full max-w-2xl aspect-square bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-dashed border-slate-300">
          <Loader2 className="h-16 w-16 text-purple-500 animate-spin mb-6" />
          <p className="text-slate-700 text-lg font-medium">Generating image, please wait...</p>
        </div>
      ) : imageUrl ? (
        <div className="w-full max-w-2xl space-y-6">
          <div className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden shadow-lg">
            <img
              src={imageUrl}
              alt="Generated image"
              className="w-full h-full object-contain"
            />
          </div>
          <Button
            onClick={handleDownload}
            className="w-full py-6 text-base font-medium"
            variant="outline"
          >
            <Download className="h-5 w-5 mr-2" />
            Download Image
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center w-full max-w-2xl aspect-square bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-dashed border-slate-300">
          <div className="text-center">
            <ImageIcon className="h-20 w-20 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 text-xl font-medium mb-2">Ready to Create</p>
            <p className="text-slate-500 text-sm">
              Upload an image and describe your edit
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

