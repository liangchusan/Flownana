"use client";

import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, ChevronDown, Send, SlidersHorizontal, Upload, X } from "lucide-react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useAccountOperation } from "@/lib/use-account-operation";
import { isAccountOperationCancelled, type CaptureAccountOperation } from "@/lib/account-operation";
import { uploadAccountMedia } from "@/lib/account-media-upload";
import { signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import {
  IMAGE_MODEL_OPTIONS,
  getImageGenerationCredits,
  type ImageModelOptionId,
  type ImageResolutionKey,
} from "@/lib/generation-pricing";
import { getGenerationErrorDisplay } from "@/lib/generation-errors";
import { GENERATION_STATUS_UNAVAILABLE, isConfirmedGenerationFailure } from "@/lib/generation-request-state";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/components/blocks/app-toast-provider";
import type { GenerationParameters } from "@/lib/creation-history";
import {
  getImageInputCapabilities,
  type GenerationInputCapabilities,
} from "@/lib/generation-input-capabilities";

const MODEL_POPUP_CLS =
  "absolute bottom-[calc(100%+0.5rem)] left-0 z-50 rounded-xl border border-stone-200/50 bg-white shadow-lg";
const OPTIONS_POPUP_CLS =
  "absolute bottom-[calc(100%+0.5rem)] right-0 z-50 rounded-xl border border-stone-200/50 bg-white shadow-lg";

interface GenerateFormProps {
  onGenerationUncertain?: (data: { optimisticId: string; outputIndex?: number }) => void;
  captureGeneration?: CaptureAccountOperation;
  onGenerate: (
    imageUrl: string,
    taskId?: string,
    prompt?: string,
    parameters?: GenerationParameters,
    optimisticId?: string,
    inputUrls?: string[],
    outputIndex?: number
  ) => void;
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
  onTaskIdChange?: (taskId: string) => void;
  onGenerationStart?: (data: {
    optimisticId: string;
    prompt: string;
    parameters: GenerationParameters;
    outputCount?: number;
  }) => void;
  onGenerationTaskCreated?: (data: {
    optimisticId: string;
    taskId: string;
    prompt?: string;
    outputIndex?: number;
  }) => void;
  onGenerationFailure?: (data: {
    optimisticId: string;
    taskId?: string;
    prompt: string;
    error: string;
    errorCode?: string;
    outputIndex?: number;
  }) => void;
  activeGenerationCount?: number;
  maxConcurrentGenerations?: number;
  initialPrompt?: string;
  initialImage?: string;
  initialImages?: string[];
  initialParameters?: GenerationParameters;
  variant?: "panel" | "composer";
  toolbarLeading?: ReactNode;
  submissionBlocked?: boolean;
  onPromptChange?: (prompt: string) => void;
  onInputImagesChange?: (urls: string[]) => void;
  onInputCapabilityChange?: (capabilities: GenerationInputCapabilities) => void;
  onParametersChange?: (parameters: GenerationParameters) => void;
}

export function GenerateForm({
  onGenerationUncertain,
  captureGeneration,
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
  initialImages,
  initialParameters,
  variant = "panel",
  toolbarLeading,
  submissionBlocked = false,
  onPromptChange,
  onInputImagesChange,
  onInputCapabilityChange,
  onParametersChange,
}: GenerateFormProps) {
  const { status } = useSession();
  const { accountScope, capture } = useAccountOperation();
  const { showToast } = useToast();
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [uploadedImages, setUploadedImages] = useState<string[]>(
    initialImages || (initialImage ? [initialImage] : [])
  );
  const [model, setModel] = useState<ImageModelOptionId>(() =>
    IMAGE_MODEL_OPTIONS.find((option) => option.label === initialParameters?.model)?.id ??
    "gpt-image-2"
  );
  const [resolution, setResolution] = useState<ImageResolutionKey>(() =>
    (initialParameters?.resolution?.toUpperCase() as ImageResolutionKey) || "1K"
  );
  const [aspectRatio, setAspectRatio] = useState(initialParameters?.aspectRatio || "1:1");
  const [outputCount, setOutputCount] = useState(() =>
    Math.min(4, Math.max(1, initialParameters?.outputCount || 1))
  );

  const [modelOpen, setModelOpen] = useState(false);
  const modelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const modelPopupRef = useRef<HTMLDivElement | null>(null);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const optionsPopupRef = useRef<HTMLDivElement | null>(null);
  const submitLockRef = useRef(false);
  const capabilityChangeRef = useRef(onInputCapabilityChange);
  const parametersChangeRef = useRef(onParametersChange);

  const imageModels = useMemo(() => IMAGE_MODEL_OPTIONS, []);
  const usesConcurrentGenerationLimit = activeGenerationCount !== undefined;
  const generationLimitReached = usesConcurrentGenerationLimit
    ? activeGenerationCount + outputCount > maxConcurrentGenerations
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
  const currentModelLabel = imageModels.find((m) => m.id === model)?.label ?? model;
  const inputCapabilities = useMemo(() => getImageInputCapabilities(model), [model]);
  const imagesOverLimit = uploadedImages.length > inputCapabilities.maxImages;
  const initialImagesKey = initialImages?.join("\u0000");

  const updatePrompt = (value: string) => {
    setPrompt(value);
    onPromptChange?.(value);
  };

  const updateImages = (urls: string[]) => {
    setUploadedImages(urls);
    onInputImagesChange?.(urls);
  };

  useEffect(() => { if (initialPrompt !== undefined) setPrompt(initialPrompt); }, [initialPrompt]);
  useEffect(() => {
    if (initialImagesKey !== undefined) {
      setUploadedImages(initialImagesKey ? initialImagesKey.split("\u0000") : []);
    }
    else if (initialImage !== undefined) setUploadedImages(initialImage ? [initialImage] : []);
  }, [initialImage, initialImagesKey]);
  useEffect(() => { capabilityChangeRef.current = onInputCapabilityChange; }, [onInputCapabilityChange]);
  useEffect(() => { parametersChangeRef.current = onParametersChange; }, [onParametersChange]);
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
    capabilityChangeRef.current?.(inputCapabilities);
  }, [inputCapabilities]);
  useEffect(() => {
    parametersChangeRef.current?.({
      model: currentModelLabel,
      resolution,
      aspectRatio,
      outputCount,
    });
  }, [aspectRatio, currentModelLabel, outputCount, resolution]);

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
    maxFiles: inputCapabilities.maxImages,
    maxSize: inputCapabilities.maxImageBytes,
    onDrop: async (files) => {
      if (files.length === 0) return;
      try {
        const operation = capture();
        const blobs = await Promise.all(files.map((file) => uploadAccountMedia(file, "image", operation)));
        operation.assertCurrent();
        updateImages(blobs.map((blob) => blob.url));
      } catch (error) {
        if (!isAccountOperationCancelled(error)) showToast({ title: "Upload failed", message: "Sign in and try uploading again.", variant: "warning" });
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
    if (status === "loading") return;
    if (!accountScope) {
      trackEvent("signup_started", { source: "image_generator" });
      await signInForCurrentEnvironment();
      return;
    }
    if (submissionBlocked || imagesOverLimit) return;
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
    const requestPrompt = prompt.trim();
    const requestImages = uploadedImages;
    const mode = requestImages.length > 0 ? "image-to-image" : "text-to-image";
    const optimisticParameters: GenerationParameters = {
      model: currentModelLabel,
      resolution,
      aspectRatio,
      mode: requestImages.length > 0 ? "Image to image" : "Text to image",
      runId: optimisticId,
      outputCount,
    };

    onGenerationStart?.({
      optimisticId,
      prompt: requestPrompt,
      parameters: optimisticParameters,
      outputCount,
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
      output_count: outputCount,
    });
    updatePrompt("");
    updateImages([]);

    const generateOne = async (outputIndex: number) => {
      try {
        const operation = (captureGeneration || capture)();
        const response = await axios.post("/api/generate", {
          prompt: requestPrompt,
          imageUrls: requestImages,
          mode,
          model,
          resolution,
          aspectRatio,
          runId: optimisticId,
          outputIndex,
          outputCount,
        }, { headers: operation.headers, signal: operation.signal });
        operation.assertCurrent();
        if (!response.data.success) throw { response };
        const taskId = response.data.taskId;
        const responsePrompt = response.data.prompt || requestPrompt;
        if (response.data.pending) {
          if (taskId) onGenerationTaskCreated?.({ optimisticId, taskId, prompt: responsePrompt, outputIndex });
          return;
        }
        if (!response.data.imageUrl) throw { response };
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
            outputIndex,
          });
        }
        onGenerate(
          response.data.imageUrl,
          taskId,
          responsePrompt,
          { ...optimisticParameters, ...response.data.parameters, outputIndex },
          optimisticId,
          response.data.inputUrls,
          outputIndex
        );
      } catch (error: any) {
        if (isAccountOperationCancelled(error)) return;
        if (!isConfirmedGenerationFailure(error)) {
          onGenerationUncertain?.({ optimisticId, outputIndex });
          showToast({ title: "Status unavailable", message: GENERATION_STATUS_UNAVAILABLE, variant: "warning" });
          return;
        }
        const errorDisplay = getGenerationErrorDisplay(
          error.response?.data || error,
          { mediaType: "image", status: error.response?.status }
        );
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
          taskId: error.response?.data?.taskId,
          prompt: requestPrompt,
          error: errorDisplay.message,
          errorCode: errorDisplay.code,
          outputIndex,
        });
        showToast({
          title: errorDisplay.title,
          message: `${errorDisplay.message} ${errorDisplay.action}`,
          variant: errorDisplay.retryable ? "error" : "warning",
        });
      }
    };

    try {
      await Promise.all(Array.from({ length: outputCount }, (_, index) => generateOne(index)));
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

  if (variant === "composer") {
    return (
      <div className="mt-2 space-y-2">
        <Textarea
          value={prompt}
          onChange={(event) => updatePrompt(event.target.value)}
          placeholder="Describe the image you want to create..."
          className="h-20 min-h-20 resize-none border-0 bg-transparent px-1 py-1 shadow-none focus-visible:ring-0"
          maxLength={5000}
        />
        <div className="flex min-h-12 flex-wrap items-center gap-1 border-t border-border pt-2">
          {toolbarLeading}
          <div className="relative w-36 sm:w-40">
            <button ref={modelTriggerRef} type="button" onClick={openModel} className="flex h-9 w-full items-center gap-1.5 rounded-ui px-2 text-xs text-foreground transition-colors duration-300 hover:bg-surface-soft">
              <span className="truncate">{currentModelLabel}</span><ChevronDown className="h-3.5 w-3.5" />
            </button>
            {renderModelPopup()}
          </div>
          <div className="relative w-40 sm:w-48">
            <button ref={optionsTriggerRef} type="button" onClick={openOptions} className="flex h-9 w-full items-center gap-1.5 rounded-ui px-2 text-xs text-foreground transition-colors duration-300 hover:bg-surface-soft">
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{aspectRatio} · {resolution} · {outputCount}</span>
            </button>
            {renderOptionsPopup()}
          </div>
          <Button type="button" onClick={handleGenerate} disabled={generationLimitReached || !prompt.trim() || submissionBlocked || imagesOverLimit} className="ml-auto h-10 gap-2 px-4">
            <span>{(creditsCost ?? 0) * outputCount} credits</span><Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Model popup ──────────────────────────────────────────────────────────
  function renderModelPopup() {
    return modelOpen && (
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
  }

  // ── Options popup ────────────────────────────────────────────────────────
  function renderOptionsPopup() {
    return optionsOpen && (
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
        <div className="py-3">
          <p className="mb-2 text-xs font-medium text-stone-400">Resolution</p>
          <div className="flex flex-wrap gap-1.5">
            {resolutionOptions.map((r) => (
              <button key={r} type="button" onClick={() => setResolution(r)} className={chipCls(resolution === r)}>{r}</button>
            ))}
          </div>
        </div>
        <div className="pt-3">
          <p className="mb-2 text-xs font-medium text-stone-400">Results</p>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setOutputCount(count)}
                className={chipCls(outputCount === count)}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Image Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-stone-900">Image</label>
        {uploadedImages.length > 0 ? (
          <div className="relative w-full aspect-video overflow-hidden rounded-2xl border border-stone-200/50 bg-stone-50 shadow-sm">
            <img src={uploadedImages[0]} alt="Uploaded" className="w-full h-full object-contain" />
            <button
              onClick={() => updateImages([])}
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
        <Textarea
          value={prompt}
          onChange={(e) => updatePrompt(e.target.value)}
          placeholder="Describe the image you want to generate or edit..."
          className="h-36 resize-none rounded-ui-xl px-4 py-3"
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
            {renderModelPopup()}
          </div>
          <div className="relative flex-1">
            <button ref={optionsTriggerRef} type="button" onClick={openOptions} className={triggerCls}>
              <span className="truncate">{aspectRatio} | {resolution}</span>
              <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-stone-500" />
            </button>
            {renderOptionsPopup()}
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generationLimitReached || !prompt.trim() || imagesOverLimit}
          className="w-full"
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
