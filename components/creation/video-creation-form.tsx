"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, Sparkles } from "lucide-react";
import axios from "axios";

interface VideoCreationFormProps {
  onGenerate: (videoUrl: string) => void;
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
}

export function VideoCreationForm({
  onGenerate,
  isGenerating,
  setIsGenerating,
}: VideoCreationFormProps) {
  const [prompt, setPrompt] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [model, setModel] = useState("veo3_fast");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState(5);

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
        };
        reader.readAsDataURL(file);
      }
    },
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    try {
      const imageUrls = uploadedImage ? [uploadedImage] : undefined;
      
      const response = await axios.post("/api/veo/generate", {
        prompt,
        imageUrls,
        model,
        aspectRatio,
        duration,
      });

      if (response.data.success) {
        onGenerate(response.data.videoUrl);
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
      {/* Image Upload - Always visible, above Prompt */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Image
        </label>
        {uploadedImage ? (
          <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300">
            <img
              src={uploadedImage}
              alt="Uploaded image"
              className="w-full h-full object-contain"
            />
            <button
              onClick={() => setUploadedImage(null)}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-lg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg aspect-video flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50 ${
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-20 w-20 text-gray-400 mb-4" />
            <p className="text-gray-600 font-medium text-base">
              {isDragActive
                ? "Drop image file"
                : "Click or drop an image to upload"}
            </p>
          </div>
        )}
      </div>

      {/* Prompt Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Prompt <span className="text-gray-500">({prompt.length}/500)</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the video you want to create..."
          className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          maxLength={500}
        />
      </div>

      {/* Settings */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
          >
            <option value="" disabled>Model</option>
            <option value="veo3_fast">VEO3 Fast</option>
            <option value="veo3_quality">VEO3 Quality</option>
          </select>
        </div>

        <div>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
          >
            <option value="" disabled>Aspect Ratio</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
            <option value="4:3">4:3</option>
          </select>
        </div>

        <div>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
          >
            <option value="" disabled>Duration (sec)</option>
            <option value={5}>5 sec</option>
            <option value={10}>10 sec</option>
            <option value={15}>15 sec</option>
          </select>
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
            <Sparkles className="h-5 w-5 mr-2" />
            Generate Video
          </>
        )}
      </Button>
    </div>
  );
}

