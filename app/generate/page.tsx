"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { GenerateForm } from "@/components/generate/generate-form";
import { ImagePreview } from "@/components/generate/image-preview";

export default function GeneratePage() {
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Nano Banana AI 图像生成
          </h1>
          <p className="text-xl text-gray-600">
            使用简单的文本描述创建或编辑图像，无需登录即可体验创作。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <GenerateForm
              onGenerate={setGeneratedImage}
              isGenerating={isGenerating}
              setIsGenerating={setIsGenerating}
            />
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <ImagePreview
              imageUrl={generatedImage}
              isGenerating={isGenerating}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

