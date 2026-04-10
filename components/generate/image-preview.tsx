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
    <div className="flex h-full w-full flex-col items-center justify-center space-y-6">
      <h2 className="text-2xl font-bold text-stone-900">Generated Result</h2>
      
      {isGenerating ? (
        <div className="flex aspect-square w-full max-w-2xl flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-gradient-to-br from-stone-50 to-zinc-100">
          <Loader2 className="mb-6 h-16 w-16 animate-spin text-stone-500" />
          <p className="text-lg font-medium text-stone-700">Generating image, please wait...</p>
        </div>
      ) : imageUrl ? (
        <div className="w-full max-w-2xl space-y-6">
          <div className="relative aspect-square overflow-hidden rounded-xl bg-stone-100 shadow-lg">
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
        <div className="flex aspect-square w-full max-w-2xl flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-gradient-to-br from-stone-50 to-zinc-100">
          <div className="text-center">
            <ImageIcon className="mx-auto mb-4 h-20 w-20 text-stone-400" />
            <p className="mb-2 text-xl font-medium text-stone-600">Ready to Create</p>
            <p className="text-sm text-stone-500">
              Upload an image and describe your edit
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

