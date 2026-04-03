"use client";

import { useState, useEffect, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";
import axios from "axios";
import {
  VIDEO_MODEL_OPTION_MAP,
  VIDEO_MODEL_OPTIONS,
  type VideoModelOption,
} from "@/lib/generation-pricing";

const getModelName = (option: VideoModelOption): string => {
  if (option.family === "kling") {
    return "Kling 3.0";
  }
  if (option.family === "seedance") {
    return "Seedance 1.5 Pro";
  }
  if (option.providerModel === "veo3_lite") {
    return "VEO 3.1 Lite";
  }
  if (option.providerModel === "veo3_fast") {
    return "VEO 3.1 Fast";
  }
  return "VEO 3.1 Quality";
};

const formatResolution = (resolution: VideoModelOption["resolution"]): string =>
  resolution === "/" ? "Auto" : resolution;

interface VideoCreationFormProps {
  onGenerate: (videoUrl: string, taskId?: string, prompt?: string) => void;
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
  onTaskIdChange?: (taskId: string) => void;
  initialPrompt?: string;
  initialImage?: string;
}

export function VideoCreationForm({
  onGenerate,
  isGenerating,
  setIsGenerating,
  onTaskIdChange,
  initialPrompt,
  initialImage,
}: VideoCreationFormProps) {
  const defaultOption = VIDEO_MODEL_OPTION_MAP.veo31_fast_8;
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [uploadedImage, setUploadedImage] = useState<string | null>(initialImage || null);
  const [selectedModelName, setSelectedModelName] = useState<string>(getModelName(defaultOption));
  const [hasAudio, setHasAudio] = useState<boolean>(!!defaultOption.hasAudio);
  const [resolution, setResolution] = useState<string>(formatResolution(defaultOption.resolution));
  const [duration, setDuration] = useState<VideoModelOption["duration"]>(defaultOption.duration);
  const [aspectRatio, setAspectRatio] = useState("16:9");

  const modelNameOptions = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const option of VIDEO_MODEL_OPTIONS) {
      const name = getModelName(option);
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
    return names;
  }, []);

  const optionsForModel = useMemo(
    () => VIDEO_MODEL_OPTIONS.filter((option) => getModelName(option) === selectedModelName),
    [selectedModelName]
  );

  const modelSupportsAudioToggle = useMemo(() => {
    const hasAudioVariant = optionsForModel.some((option) => !!option.hasAudio);
    const hasSilentVariant = optionsForModel.some((option) => !option.hasAudio);
    return hasAudioVariant && hasSilentVariant;
  }, [optionsForModel]);

  const optionsForAudio = useMemo(() => {
    if (!modelSupportsAudioToggle) {
      return optionsForModel;
    }
    return optionsForModel.filter((option) => !!option.hasAudio === hasAudio);
  }, [hasAudio, modelSupportsAudioToggle, optionsForModel]);

  const resolutionOptions = useMemo(() => {
    return [...new Set(optionsForAudio.map((option) => formatResolution(option.resolution)))];
  }, [optionsForAudio]);

  const optionsForResolution = useMemo(
    () =>
      optionsForAudio.filter(
        (option) => formatResolution(option.resolution) === resolution
      ),
    [optionsForAudio, resolution]
  );

  const durationOptions = useMemo(
    () => [...new Set(optionsForResolution.map((option) => option.duration))],
    [optionsForResolution]
  );

  const selectedOption = useMemo(() => {
    const exact = optionsForResolution.find((option) => option.duration === duration);
    return exact ?? optionsForResolution[0] ?? optionsForAudio[0] ?? optionsForModel[0];
  }, [duration, optionsForAudio, optionsForModel, optionsForResolution]);

  useEffect(() => {
    if (modelNameOptions.length > 0 && !modelNameOptions.includes(selectedModelName)) {
      setSelectedModelName(modelNameOptions[0]);
    }
  }, [modelNameOptions, selectedModelName]);

  useEffect(() => {
    if (!modelSupportsAudioToggle && hasAudio) {
      setHasAudio(false);
    }
  }, [hasAudio, modelSupportsAudioToggle]);

  useEffect(() => {
    if (resolutionOptions.length > 0 && !resolutionOptions.includes(resolution)) {
      setResolution(resolutionOptions[0]);
    }
  }, [resolution, resolutionOptions]);

  useEffect(() => {
    if (durationOptions.length > 0 && !durationOptions.includes(duration)) {
      setDuration(durationOptions[0]);
    }
  }, [duration, durationOptions]);

  // 当外部传入初始值时更新
  useEffect(() => {
    if (initialPrompt !== undefined) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    if (initialImage !== undefined) {
      setUploadedImage(initialImage);
    }
  }, [initialImage]);

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
    if (!selectedOption) {
      alert("Invalid model settings, please adjust and try again.");
      return;
    }

    setIsGenerating(true);
    try {
      const imageUrls = uploadedImage ? [uploadedImage] : undefined;
      
      const response = await axios.post("/api/veo/generate", {
        prompt,
        imageUrls,
        modelOptionId: selectedOption?.id,
        aspectRatio,
      });

      if (response.data.success) {
        const taskId = response.data.taskId;
        const responsePrompt = response.data.prompt || prompt;
        if (taskId && onTaskIdChange) {
          onTaskIdChange(taskId);
        }
        onGenerate(response.data.videoUrl, taskId, responsePrompt);
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
    <div className="space-y-6 h-full flex flex-col">
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
            <Upload className="h-10 w-10 text-gray-400 mb-3" />
            <p className="text-gray-600 text-sm">
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
          Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the video you want to create..."
          className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm placeholder:text-sm"
          maxLength={500}
        />
      </div>

      <div className="mt-auto space-y-3">
        {/* Bottom Settings */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <select
            value={selectedModelName}
            onChange={(e) => setSelectedModelName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
            aria-label="Model"
          >
            <option value="" disabled>
              Model
            </option>
            {modelNameOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
            aria-label="Resolution"
          >
            <option value="" disabled>
              Resolution
            </option>
            {resolutionOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <select
            value={String(duration)}
            onChange={(e) =>
              setDuration(Number(e.target.value) as VideoModelOption["duration"])
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
            aria-label="Duration"
          >
            <option value="" disabled>
              Duration
            </option>
            {durationOptions.map((value) => (
              <option key={value} value={value}>
                {value}s
              </option>
            ))}
          </select>

          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
            aria-label="Ratio"
          >
            <option value="" disabled>
              Ratio
            </option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
            <option value="4:3">4:3</option>
          </select>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-xs text-gray-500">Sound</span>
          <button
            type="button"
            role="switch"
            aria-checked={hasAudio}
            onClick={() => modelSupportsAudioToggle && setHasAudio(!hasAudio)}
            disabled={!modelSupportsAudioToggle}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              hasAudio ? "bg-blue-500" : "bg-gray-300"
            } ${!modelSupportsAudioToggle ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                hasAudio ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim() || !selectedOption}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate"
          )}
        </Button>

        <p className="text-xs text-gray-500">
          This generation will cost {selectedOption?.credits ?? 0} credits.
        </p>
      </div>
    </div>
  );
}
