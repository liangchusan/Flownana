"use client";

import { useState, useEffect, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, X } from "lucide-react";
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
    <div className="h-full flex flex-col gap-8">
      {/* Image Upload - Always visible, above Prompt */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-900">
          Image
        </label>
        {uploadedImage ? (
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200/60 bg-slate-50 shadow-sm">
            <img
              src={uploadedImage}
              alt="Uploaded image"
              className="w-full h-full object-contain"
            />
            <button
              onClick={() => setUploadedImage(null)}
              className="absolute top-2 right-2 rounded-full border border-slate-200/60 bg-white p-1.5 text-slate-600 shadow-sm transition-all duration-200 hover:text-slate-900 hover:shadow-md active:scale-[0.98]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`aspect-video rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
              isDragActive
                ? "border-slate-500 bg-slate-100"
                : "hover:border-slate-400 hover:bg-slate-100/60"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-9 w-9 text-slate-400 mb-3" />
            <p className="text-slate-600 text-sm">
              {isDragActive
                ? "Drop image file"
                : "Click or drop an image to upload"}
            </p>
          </div>
        )}
      </div>

      {/* Prompt Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-900">
          Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the video you want to create..."
          className="h-36 w-full resize-none rounded-2xl border border-slate-200/60 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-all duration-200 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300"
          maxLength={500}
        />
      </div>

      <div className="mt-auto space-y-4">
        {/* Bottom Settings — 与图片生成：同一行选项 + 蓝紫渐变主按钮 */}
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[100px] flex-[1.25]">
          <Select
            value={selectedModelName}
            onChange={(e) => setSelectedModelName(e.target.value)}
            aria-label="Model"
            menuLabel="Model"
          >
            {modelNameOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          </div>

          <div className="min-w-[72px] flex-1">
          <Select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            aria-label="Resolution"
            menuLabel="Resolution"
          >
            {resolutionOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          </div>

          <div className="min-w-[72px] flex-1">
          <Select
            value={String(duration)}
            onChange={(e) =>
              setDuration(Number(e.target.value) as VideoModelOption["duration"])
            }
            aria-label="Duration"
            menuLabel="Duration"
          >
            {durationOptions.map((value) => (
              <option key={value} value={value}>
                {value}s
              </option>
            ))}
          </Select>
          </div>

          <div className="min-w-[72px] flex-1">
          <Select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            aria-label="Ratio"
            menuLabel="Ratio"
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
            <option value="4:3">4:3</option>
          </Select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-700">Sound</span>
            <span className="text-xs text-slate-500">
              {modelSupportsAudioToggle
                ? hasAudio
                  ? "Native Audio On"
                  : "Native Audio Off"
                : "Not available for this model"}
            </span>
          </div>
          <Switch
            checked={hasAudio}
            onCheckedChange={(next) => {
              if (modelSupportsAudioToggle) {
                setHasAudio(next);
              }
            }}
            disabled={!modelSupportsAudioToggle}
          />
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim() || !selectedOption}
          className="w-full rounded-full border-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm transition-all duration-200 hover:from-blue-700 hover:to-blue-800 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate"
          )}
        </Button>

        <p className="text-xs text-slate-600">
          This generation will cost {selectedOption?.credits ?? 0} credits.
        </p>
      </div>
    </div>
  );
}
