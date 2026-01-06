"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";
import axios from "axios";

interface GenerateFormProps {
  onGenerate: (imageUrl: string) => void;
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
}

export function GenerateForm({
  onGenerate,
  isGenerating,
  setIsGenerating,
}: GenerateFormProps) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"text-to-image" | "image-to-image">("text-to-image");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resolution, setResolution] = useState("1K");
  const [aspectRatio, setAspectRatio] = useState("1:1");

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        const reader = new FileReader();
        reader.onload = () => {
          setUploadedImage(reader.result as string);
          setMode("image-to-image");
        };
        reader.readAsDataURL(file);
      }
    },
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert("请输入提示词");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await axios.post("/api/generate", {
        prompt,
        imageUrl: uploadedImage,
        mode,
        resolution,
        aspectRatio,
      });

      if (response.data.success) {
        onGenerate(response.data.imageUrl);
      } else {
        alert("生成失败，请重试");
      }
    } catch (error) {
      console.error("生成错误:", error);
      alert("生成失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          模式
        </label>
        <div className="flex gap-2">
          <Button
            variant={mode === "text-to-image" ? "default" : "outline"}
            onClick={() => {
              setMode("text-to-image");
              setUploadedImage(null);
            }}
            className="flex-1"
          >
            文本生成图像
          </Button>
          <Button
            variant={mode === "image-to-image" ? "default" : "outline"}
            onClick={() => setMode("image-to-image")}
            className="flex-1"
          >
            图像编辑
          </Button>
        </div>
      </div>

      {mode === "image-to-image" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            上传图像
          </label>
          {uploadedImage ? (
            <div className="relative">
              <img
                src={uploadedImage}
                alt="上传的图像"
                className="w-full h-48 object-cover rounded-lg"
              />
              <button
                onClick={() => setUploadedImage(null)}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary-500 bg-primary-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {isDragActive
                  ? "放下图像文件"
                  : "点击上传或拖放图像文件"}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                PNG, JPG, JPEG, WEBP
              </p>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          提示词 <span className="text-gray-500">({prompt.length}/5000)</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述您想要生成的图像或编辑..."
          className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          maxLength={5000}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            分辨率
          </label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="1K">1K</option>
            <option value="2K">2K</option>
            <option value="4K">4K</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            宽高比
          </label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="1:1">1:1</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="4:3">4:3</option>
            <option value="3:4">3:4</option>
          </select>
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim()}
        className="w-full"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            生成中...
          </>
        ) : (
          "生成图像"
        )}
      </Button>
    </div>
  );
}



