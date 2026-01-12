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
      // Automatically determine mode based on whether image is uploaded
      const mode = uploadedImage ? "image-to-image" : "text-to-image";
      
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
        alert("Generation failed, please try again");
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      const errorMessage = error.response?.data?.error || error.message || "Generation failed, please try again";
      alert(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Image Upload - Always visible, above Prompt */}
      <div className="mb-6">
        {uploadedImage ? (
          <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300">
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
            className={`border-2 border-dashed rounded-lg p-16 text-center cursor-pointer transition-colors bg-gray-50 ${
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-20 w-20 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium text-base">
              {isDragActive
                ? "Drop image file"
                : "Click or drop an image to upload"}
            </p>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Prompt <span className="text-gray-500">({prompt.length}/5000)</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate or edit..."
          className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          maxLength={5000}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Resolution
          </label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="1K">1K</option>
            <option value="2K">2K</option>
            <option value="4K">4K</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Aspect Ratio
          </label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          "Generate Image"
        )}
      </Button>
    </div>
  );
}



