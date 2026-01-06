"use client";

import { Download, Loader2 } from "lucide-react";
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
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">生成结果</h2>
      
      {isGenerating ? (
        <div className="flex flex-col items-center justify-center h-96 bg-gray-100 rounded-lg">
          <Loader2 className="h-12 w-12 text-primary-500 animate-spin mb-4" />
          <p className="text-gray-600">正在生成图像，请稍候...</p>
        </div>
      ) : imageUrl ? (
        <div className="space-y-4">
          <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={imageUrl}
              alt="生成的图像"
              className="w-full h-full object-contain"
            />
          </div>
          <Button
            onClick={handleDownload}
            className="w-full"
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            下载图像
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-96 bg-gray-100 rounded-lg">
          <p className="text-gray-500 text-lg">准备创建</p>
          <p className="text-gray-400 text-sm mt-2">
            上传图像并描述您的编辑
          </p>
        </div>
      )}
    </div>
  );
}

