"use client";

import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useDropzone } from "react-dropzone";
import { GenerationSettings } from "@/components/blocks/generation-settings";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Upload, X } from "lucide-react";
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
import { getImageAspectRatios, getImagePromptMinLength, IMAGE_PROMPT_MAX_LENGTH } from "@/lib/image-model-capabilities";
import { getGenerationErrorDisplay } from "@/lib/generation-errors";
import { GENERATION_STATUS_UNAVAILABLE, isConfirmedGenerationFailure } from "@/lib/generation-request-state";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/components/blocks/app-toast-provider";
import type { GenerationParameters } from "@/lib/creation-history";
import {
  getImageInputCapabilities,
  type GenerationInputCapabilities,
} from "@/lib/generation-input-capabilities";

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
  menuPlacement?: "above" | "below";
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
  menuPlacement = "above",
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
  const [settingsNotice, setSettingsNotice] = useState("");
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


  const submitLockRef = useRef(false);
  const capabilityChangeRef = useRef(onInputCapabilityChange);
  const parametersChangeRef = useRef(onParametersChange);

  const imageModels = useMemo(() => IMAGE_MODEL_OPTIONS, []);
  const usesConcurrentGenerationLimit = activeGenerationCount !== undefined;
  const generationLimitReached = usesConcurrentGenerationLimit
    ? activeGenerationCount + outputCount > maxConcurrentGenerations
    : isGenerating;
  const ratioOptions = useMemo(
    () => getImageAspectRatios(model, resolution, uploadedImages.length),
    [model, resolution, uploadedImages.length]
  );
  const resolutionOptions = useMemo(() => {
    const option = imageModels.find((m) => m.id === model);
    return option?.resolutions ?? (["1K", "2K", "4K"] as ImageResolutionKey[]);
  }, [imageModels, model]);
  const hasResolution = resolutionOptions.length > 0;
  const creditsCost = getImageGenerationCredits(model, resolution, uploadedImages.length);
  const needsReferenceForPricing = !!imageModels.find(m => m.id === model)?.imageToImagePricing && uploadedImages.length === 0;
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
      const next = ratioOptions[0] || "1:1";
      setSettingsNotice(`Aspect ratio changed to ${next} to match this model.`);
      setAspectRatio(next);
    }
  }, [aspectRatio, ratioOptions]);
  useEffect(() => {
    if (hasResolution && !resolutionOptions.includes(resolution)) {
      setSettingsNotice(`Resolution changed to ${resolutionOptions[0]} to match this model.`);
      setResolution(resolutionOptions[0] || "1K");
    }
  }, [resolution, resolutionOptions, hasResolution]);
  useEffect(() => {
    capabilityChangeRef.current?.(inputCapabilities);
  }, [inputCapabilities]);
  useEffect(() => {
    parametersChangeRef.current?.({
      model: currentModelLabel,
      ...(hasResolution ? { resolution } : {}),
      aspectRatio,
      outputCount,
    });
  }, [aspectRatio, currentModelLabel, outputCount, resolution, hasResolution]);

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
    if (submissionBlocked || imagesOverLimit || !creditsCost || (prompt.trim().length > IMAGE_PROMPT_MAX_LENGTH || prompt.trim().length < getImagePromptMinLength(model)) || !ratioOptions.includes(aspectRatio) || (hasResolution && !resolutionOptions.includes(resolution))) return;
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
      ...(hasResolution ? { resolution } : {}),
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
      ...(hasResolution ? { resolution } : {}),
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
          ...(hasResolution ? { resolution } : {}),
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
          ...(hasResolution ? { resolution } : {}),
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

  const settingsControl = <GenerationSettings placement={menuPlacement} models={imageModels} model={model} onModel={v => setModel(v as ImageModelOptionId)} ratios={ratioOptions} ratio={aspectRatio} onRatio={setAspectRatio} resolutions={resolutionOptions} resolution={resolution} onResolution={v => setResolution(v as ImageResolutionKey)} count={outputCount} onCount={setOutputCount} notice={settingsNotice} />;

  if (variant === "composer") {
    return (
      <div className="mt-2 space-y-2">
        <div className="relative h-20">
          <Textarea
            value={prompt}
            onChange={(event) => updatePrompt(event.target.value)}
            placeholder="Describe the image you want to create..."
            className="h-20 min-h-20 resize-none border-0 bg-transparent px-1 pb-1 pt-1 shadow-none focus-visible:ring-0"
            minLength={getImagePromptMinLength(model)}
            maxLength={IMAGE_PROMPT_MAX_LENGTH}
          />
        </div>
        <div className="flex min-h-12 items-start gap-1 border-t border-border pt-2">
          {toolbarLeading}
          {settingsControl}
          <Button type="button" onClick={handleGenerate} disabled={!creditsCost || (prompt.trim().length > IMAGE_PROMPT_MAX_LENGTH || prompt.trim().length < getImagePromptMinLength(model)) || generationLimitReached || !prompt.trim() || submissionBlocked || imagesOverLimit} className="ml-auto h-10 gap-2 px-4">
            <span>{creditsCost ? `${creditsCost * outputCount} credits` : needsReferenceForPricing ? "Add a reference image" : "Temporarily unavailable"}</span><Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Image Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">Image</label>
        {uploadedImages.length > 0 ? (
          <div className="relative w-full aspect-video overflow-hidden rounded-2xl border border-border/50 bg-surface-soft shadow-sm">
            <img src={uploadedImages[0]} alt="Uploaded" className="w-full h-full object-contain" />
            <button
              onClick={() => updateImages([])}
              className="absolute right-2 top-2 rounded-full border border-border/50 bg-background p-1.5 text-muted-foreground shadow-sm transition-all duration-300 hover:text-foreground hover:shadow-md active:scale-[0.98]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`aspect-video flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-input bg-surface-soft/70 transition-all duration-300 ${
              isDragActive ? "border-muted-foreground bg-surface-strong" : "hover:border-muted-foreground hover:bg-surface-strong/60"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mb-3 h-9 w-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isDragActive ? "Drop image file" : "Click or drop an image to upload"}
            </p>
          </div>
        )}
      </div>

      {/* Prompt */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">Prompt</label>
        <Textarea
          value={prompt}
          onChange={(e) => updatePrompt(e.target.value)}
          placeholder="Describe the image you want to generate or edit..."
          className="h-36 resize-none rounded-ui-xl px-4 py-3"
          minLength={getImagePromptMinLength(model)}
          maxLength={IMAGE_PROMPT_MAX_LENGTH}
        />
      </div>

      <div className="space-y-4">
        <div className="flex">{settingsControl}</div>

        <Button
          onClick={handleGenerate}
          disabled={!creditsCost || (prompt.trim().length > IMAGE_PROMPT_MAX_LENGTH || prompt.trim().length < getImagePromptMinLength(model)) || generationLimitReached || !prompt.trim() || imagesOverLimit}
          className="w-full"
          size="lg"
        >
          {generationLimitReached ? `Generating ${maxConcurrentGenerations}/${maxConcurrentGenerations}` : "Generate"}
        </Button>

        <p className="text-xs text-muted-foreground">
          {creditsCost ? `This generation will cost ${creditsCost * outputCount} credits.` : needsReferenceForPricing ? "Add a reference image to use this model." : "This model is temporarily unavailable."}
        </p>
      </div>
    </div>
  );
}
