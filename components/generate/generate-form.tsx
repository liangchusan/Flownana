"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Upload, X } from "lucide-react";
import axios from "axios";
import {
  IMAGE_MODEL_OPTIONS,
  getImageGenerationCredits,
  type ImageModelOptionId,
  type ImageResolutionKey,
} from "@/lib/generation-pricing";
import { getGenerationErrorDisplay } from "@/lib/generation-errors";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/components/blocks/app-toast-provider";
import type { GenerationParameters } from "@/lib/creation-history";

const MODEL_POPUP_CLS =
  "absolute bottom-[calc(100%+0.5rem)] left-0 z-50 rounded-xl border border-stone-200/50 bg-white shadow-lg";
const OPTIONS_POPUP_CLS =
  "absolute bottom-[calc(100%+0.5rem)] right-0 z-50 rounded-xl border border-stone-200/50 bg-white shadow-lg";
const MAX_INPUT_IMAGE_BYTES = 20 * 1024 * 1024;

interface GenerateFormProps {
  onGenerate: (
    imageUrl: string,
    taskId?: string,
    prompt?: string,
    parameters?: GenerationParameters,
    optimisticId?: string,
    inputUrls?: string[]
  ) => void;
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
  onTaskIdChange?: (taskId: string) => void;
  onGenerationStart?: (data: {
    optimisticId: string;
    prompt: string;
    parameters: GenerationParameters;
  }) => void;
  onGenerationTaskCreated?: (data: {
    optimisticId: string;
    taskId: string;
    prompt?: string;
  }) => void;
  onGenerationFailure?: (data: {
    optimisticId: string;
    prompt: string;
    error: string;
    errorCode?: string;
  }) => void;
  activeGenerationCount?: number;
  maxConcurrentGenerations?: number;
  initialPrompt?: string;
  initialImage?: string;
}

export function GenerateForm({
  onGenerate,
  isGenerating,
  setIsGenerating,
  onTaskIdChange,
  onGenerationStart,
  onGenerationTaskCreated,
  onGenerationFailure,
  activeGenerationCount,
  maxConcurrentGenerations = 5,
  initialPrompt,
  initialImage,
}: GenerateFormProps) {
  const { showToast } = useToast();
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [uploadedImage, setUploadedImage] = useState<string | null>(initialImage || null);
  const [model, setModel] = useState<ImageModelOptionId>("gpt-image-2");
  const [resolution, setResolution] = useState<ImageResolutionKey>("1K");
  const [aspectRatio, setAspectRatio] = useState("1:1");

  const [modelOpen, setModelOpen] = useState(false);
  const modelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const modelPopupRef = useRef<HTMLDivElement | null>(null);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const optionsPopupRef = useRef<HTMLDivElement | null>(null);
  const submitLockRef = useRef(false);

  const imageModels = useMemo(() => IMAGE_MODEL_OPTIONS, []);
  const usesConcurrentGenerationLimit = activeGenerationCount !== undefined;
  const generationLimitReached = usesConcurrentGenerationLimit
    ? activeGenerationCount >= maxConcurrentGenerations
    : isGenerating;
  const ratioOptions = useMemo(
    () =>
      ["auto", "9:16", "16:9", "1:1", "3:4", "4:3"].filter((ratio) => {
        if (model === "qwen-image-3-pro" && ratio === "auto") {
          return false;
        }
        if (model === "gpt-image-2" && ratio === "auto") {
          return resolution === "1K";
        }
        if (model === "gpt-image-2" && resolution === "4K" && ratio === "1:1") {
          return false;
        }
        return true;
      }),
    [model, resolution]
  );
  const resolutionOptions = useMemo(() => {
    const option = imageModels.find((m) => m.id === model);
    return option?.resolutions ?? (["1K", "2K", "4K"] as ImageResolutionKey[]);
  }, [imageModels, model]);
  const creditsCost = getImageGenerationCredits(model, resolution);

  useEffect(() => { if (initialPrompt !== undefined) setPrompt(initialPrompt); }, [initialPrompt]);
  useEffect(() => { if (initialImage !== undefined) setUploadedImage(initialImage); }, [initialImage]);
  useEffect(() => {
    if (!ratioOptions.includes(aspectRatio)) {
      setAspectRatio(ratioOptions[0] || "1:1");
    }
  }, [aspectRatio, ratioOptions]);
  useEffect(() => {
    if (!resolutionOptions.includes(resolution)) {
      setResolution(resolutionOptions[0] || "1K");
    }
  }, [resolution, resolutionOptions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!modelTriggerRef.current?.contains(t) && !modelPopupRef.current?.contains(t))
        setModelOpen(false);
      if (!optionsTriggerRef.current?.contains(t) && !optionsPopupRef.current?.contains(t))
        setOptionsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openModel = () => {
    setModelOpen((p) => !p);
    setOptionsOpen(false);
  };

  const openOptions = () => {
    setOptionsOpen((p) => !p);
    setModelOpen(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
    maxSize: MAX_INPUT_IMAGE_BYTES,
    onDrop: (files) => {
      if (files.length > 0) {
        const reader = new FileReader();
        reader.onload = () => setUploadedImage(reader.result as string);
        reader.readAsDataURL(files[0]);
      }
    },
    onDropRejected: (rejections) => {
      const code = rejections.some((rejection) =>
        rejection.errors.some((error) => error.code === "file-too-large")
      )
        ? "file_too_large"
        : "unsupported_file_type";
      const display = getGenerationErrorDisplay(
        { errorCode: code },
        { mediaType: "image" }
      );
      showToast({
        title: display.title,
        message: `${display.message} ${display.action}`,
        variant: "warning",
      });
    },
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      const display = getGenerationErrorDisplay(
        { errorCode: "prompt_required" },
        { mediaType: "image" }
      );
      showToast({
        title: display.title,
        message: `${display.message} ${display.action}`,
        variant: "warning",
      });
      return;
    }
    if (generationLimitReached) {
      showToast({
        title: "Generation limit reached",
        message: `You can run up to ${maxConcurrentGenerations} image generations at once.`,
        variant: "warning",
      });
      return;
    }
    if (submitLockRef.current) {
      return;
    }
    submitLockRef.current = true;
    window.setTimeout(() => {
      submitLockRef.current = false;
    }, 700);

    const optimisticId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const mode = uploadedImage ? "image-to-image" : "text-to-image";
    const optimisticParameters: GenerationParameters = {
      model: currentModelLabel,
      resolution,
      aspectRatio,
      mode: uploadedImage ? "Image to image" : "Text to image",
    };

    onGenerationStart?.({
      optimisticId,
      prompt,
      parameters: optimisticParameters,
    });
    if (!usesConcurrentGenerationLimit) {
      setIsGenerating(true);
    }
    trackEvent("generation_started", {
      type: "image",
      model,
      resolution,
      aspect_ratio: aspectRatio,
      credits_cost: creditsCost,
      mode,
    });
    try {
      const response = await axios.post("/api/generate", {
        prompt,
        imageUrl: uploadedImage,
        mode,
        model,
        resolution,
        aspectRatio,
      });
      if (response.data.success) {
        const taskId = response.data.taskId;
        const responsePrompt = response.data.prompt || prompt;
        trackEvent("generation_success", {
          type: "image",
          model,
          resolution,
          aspect_ratio: aspectRatio,
          credits_cost: response.data.creditsCost || creditsCost,
        });
        if (taskId && onTaskIdChange) onTaskIdChange(taskId);
        if (taskId) {
          onGenerationTaskCreated?.({
            optimisticId,
            taskId,
            prompt: responsePrompt,
          });
        }
        onGenerate(response.data.imageUrl, taskId, responsePrompt, {
          ...optimisticParameters,
          ...response.data.parameters,
        }, optimisticId, response.data.inputUrls);
      } else {
        trackEvent("generation_failed", {
          type: "image",
          model,
          error: "unknown",
        });
        onGenerationFailure?.({
          optimisticId,
          prompt,
          error: "Generation failed, please try again",
        });
        showToast({
          title: "Generation failed",
          message: "Generation failed, please try again",
          variant: "error",
        });
      }
    } catch (error: any) {
      const errorDisplay = getGenerationErrorDisplay(
        error.response?.data || error,
        { mediaType: "image", status: error.response?.status }
      );
      const message = errorDisplay.message;
      if (error.response?.status === 402) {
        trackEvent("insufficient_credits_shown", {
          type: "image",
          required: error.response?.data?.required,
          available: error.response?.data?.available,
        });
      }
      trackEvent("generation_failed", {
        type: "image",
        model,
        error: error.response?.data?.errorCode || errorDisplay.code,
      });
      onGenerationFailure?.({
        optimisticId,
        prompt,
        error: message,
        errorCode: errorDisplay.code,
      });
      showToast({
        title: errorDisplay.title,
        message: `${message} ${errorDisplay.action}`,
        variant: errorDisplay.retryable ? "error" : "warning",
      });
    } finally {
      if (!usesConcurrentGenerationLimit) {
        setIsGenerating(false);
      }
    }
  };

  // ── Shared classes ───────────────────────────────────────────────────────
  const triggerCls =
    "flex h-full w-full items-center justify-between rounded-xl border border-stone-200/50 bg-white px-3 py-[7px] text-left text-xs text-stone-900 transition-all duration-300 hover:border-stone-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-500";

  const chipCls = (active: boolean) =>
    `rounded-xl border px-3 py-1.5 text-sm font-medium transition-all duration-300 active:scale-[0.98] ${
      active
        ? "border-stone-300 bg-stone-100 text-stone-900"
        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
    }`;

  const currentModelLabel = imageModels.find((m) => m.id === model)?.label ?? model;

  // ── Model popup ──────────────────────────────────────────────────────────
  const modelPopup = modelOpen && (
    <div
      ref={modelPopupRef}
      className={`${MODEL_POPUP_CLS} w-[min(220px,calc(100vw-2rem))] py-1.5`}
    >
      <p className="px-3 pb-1.5 pt-1 text-xs font-medium text-stone-400">Model</p>
      {imageModels.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => { setModel(m.id); setModelOpen(false); }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-all duration-300 ${
            model === m.id
              ? "bg-stone-100 text-stone-900"
              : "text-stone-700 hover:bg-stone-50"
          }`}
        >
          <Check className={`h-3.5 w-3.5 shrink-0 ${model === m.id ? "text-stone-500" : "text-transparent"}`} />
          {m.label}
        </button>
      ))}
    </div>
  );

  // ── Options popup ────────────────────────────────────────────────────────
  const optionsPopup = optionsOpen && (
    <div
      ref={optionsPopupRef}
      className={`${OPTIONS_POPUP_CLS} w-[min(280px,calc(100vw-2rem))] px-4 py-3`}
    >
      <div className="divide-y divide-stone-100">
        <div className="pb-3">
          <p className="mb-2 text-xs font-medium text-stone-400">Aspect Ratio</p>
          <div className="flex flex-wrap gap-1.5">
            {ratioOptions.map((r) => (
              <button key={r} type="button" onClick={() => setAspectRatio(r)} className={chipCls(aspectRatio === r)}>{r}</button>
            ))}
          </div>
        </div>
        <div className="pt-3">
          <p className="mb-2 text-xs font-medium text-stone-400">Resolution</p>
          <div className="flex flex-wrap gap-1.5">
            {resolutionOptions.map((r) => (
              <button key={r} type="button" onClick={() => setResolution(r)} className={chipCls(resolution === r)}>{r}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Image Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-stone-900">Image</label>
        {uploadedImage ? (
          <div className="relative w-full aspect-video overflow-hidden rounded-2xl border border-stone-200/50 bg-stone-50 shadow-sm">
            <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-contain" />
            <button
              onClick={() => setUploadedImage(null)}
              className="absolute right-2 top-2 rounded-full border border-stone-200/50 bg-white p-1.5 text-stone-600 shadow-sm transition-all duration-300 hover:text-stone-900 hover:shadow-md active:scale-[0.98]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`aspect-video flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50/70 transition-all duration-300 ${
              isDragActive ? "border-stone-500 bg-stone-100" : "hover:border-stone-400 hover:bg-stone-100/60"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mb-3 h-9 w-9 text-stone-400" />
            <p className="text-sm text-stone-600">
              {isDragActive ? "Drop image file" : "Click or drop an image to upload"}
            </p>
          </div>
        )}
      </div>

      {/* Prompt */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-stone-900">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate or edit..."
          className="h-36 w-full resize-none rounded-2xl border border-stone-200/50 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition-all duration-300 placeholder:text-stone-400 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-300"
          maxLength={5000}
        />
      </div>

      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-[1.5]">
            <button ref={modelTriggerRef} type="button" onClick={openModel} className={triggerCls}>
              <span className="truncate">{currentModelLabel}</span>
              <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-stone-500" />
            </button>
            {modelPopup}
          </div>
          <div className="relative flex-1">
            <button ref={optionsTriggerRef} type="button" onClick={openOptions} className={triggerCls}>
              <span className="truncate">{aspectRatio} | {resolution}</span>
              <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-stone-500" />
            </button>
            {optionsPopup}
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generationLimitReached || !prompt.trim()}
          className="w-full rounded-xl border-0 bg-stone-800 text-white shadow-sm transition-all duration-300 hover:bg-stone-800/90 active:scale-[0.98] disabled:opacity-50"
          size="lg"
        >
          {generationLimitReached ? `Generating ${maxConcurrentGenerations}/${maxConcurrentGenerations}` : "Generate"}
        </Button>

        <p className="text-xs text-stone-600">
          This generation will cost {creditsCost} credits.
        </p>
      </div>
    </div>
  );
}
