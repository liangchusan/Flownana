"use client";

import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useDropzone } from "react-dropzone";
import { GenerationSettings } from "@/components/blocks/generation-settings";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Upload, X } from "lucide-react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useAccountOperation } from "@/lib/use-account-operation";
import { isAccountOperationCancelled, type CaptureAccountOperation } from "@/lib/account-operation";
import { uploadAccountMedia } from "@/lib/account-media-upload";
import {
  VIDEO_MODEL_OPTIONS,
  formatVideoResolution,
  getDisplayAspectRatios,
  getDisplayResolutions,
  videoFollowsInputRatio,
  DEFAULT_VIDEO_RESOLUTIONS,
  getVideoModelName,
  type VideoAspectRatio,
  type VideoModelOption,
  type VideoResolutionOption,
} from "@/lib/generation-pricing";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/components/blocks/app-toast-provider";
import { getSignInLabel, signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import { getGenerationErrorDisplay } from "@/lib/generation-errors";
import { GENERATION_STATUS_UNAVAILABLE, isConfirmedGenerationFailure, pollGenerationResult } from "@/lib/generation-request-state";
import type { GenerationParameters } from "@/lib/creation-history";
import {
  getVideoInputCapabilities,
  type GenerationInputCapabilities,
} from "@/lib/generation-input-capabilities";

interface VideoCreationFormProps {
  onGenerationUncertain?: (data: { optimisticId: string }) => void;
  captureGeneration?: CaptureAccountOperation;
  onGenerate: (
    videoUrl: string,
    taskId?: string,
    prompt?: string,
    optimisticId?: string,
    parameters?: GenerationParameters,
    inputUrls?: string[]
  ) => void;
  onGenerationStart?: (data: {
    optimisticId: string;
    prompt: string;
    parameters: GenerationParameters;
  }) => void;
  onGenerationTaskCreated?: (data: {
    optimisticId: string;
    taskId: string;
    prompt: string;
    inputUrls?: string[];
  }) => void;
  onGenerationFailure?: (data: {
    optimisticId: string;
    prompt: string;
    error: string;
    errorCode?: string;
  }) => void;
  activeGenerationCount?: number;
  maxConcurrentGenerations?: number;
  isGenerating?: boolean;
  setIsGenerating?: (value: boolean) => void;
  onTaskIdChange?: (taskId: string) => void;
  initialPrompt?: string;
  initialImage?: string;
  initialImages?: string[];
  inputAttachments?: Array<{ url: string; kind: "image" | "video" | "audio" }>;
  initialParameters?: GenerationParameters;
  variant?: "panel" | "composer";
  menuPlacement?: "above" | "below";
  toolbarLeading?: ReactNode;
  submissionBlocked?: boolean;
  onPromptChange?: (prompt: string) => void;
  onInputImagesChange?: (urls: string[]) => void;
  onInputAttachmentsChange?: (attachments: Array<{ url: string; kind: "image" | "video" | "audio" }>) => void;
  onInputCapabilityChange?: (capabilities: GenerationInputCapabilities) => void;
  onParametersChange?: (parameters: GenerationParameters) => void;
}

export function VideoCreationForm({
  onGenerationUncertain,
  captureGeneration,
  onGenerate,
  onGenerationStart,
  onGenerationTaskCreated,
  onGenerationFailure,
  activeGenerationCount,
  maxConcurrentGenerations = 5,
  isGenerating = false,
  setIsGenerating,
  onTaskIdChange,
  initialPrompt,
  initialImage,
  initialImages,
  inputAttachments,
  initialParameters,
  variant = "panel",
  menuPlacement = "above",
  toolbarLeading,
  submissionBlocked = false,
  onPromptChange,
  onInputImagesChange,
  onInputAttachmentsChange,
  onInputCapabilityChange,
  onParametersChange,
}: VideoCreationFormProps) {
  const { showToast } = useToast();
  const { data: session, status } = useSession();
  const { capture } = useAccountOperation();
  const defaultOption = VIDEO_MODEL_OPTIONS[0];
  const [settingsNotice, setSettingsNotice] = useState("");
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [uploadedImages, setUploadedImages] = useState<string[]>(
    initialImages || (initialImage ? [initialImage] : [])
  );
  const requestInputs = inputAttachments || uploadedImages.map((url) => ({ url, kind: "image" as const }));
  const inputImageCount = requestInputs.filter((input) => input.kind === "image").length;
  const hasVideoInput = requestInputs.some((input) => input.kind === "video");
  const [selectedModelName, setSelectedModelName] = useState<string>(
    initialParameters?.model || getVideoModelName(defaultOption)
  );
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>(
    (initialParameters?.aspectRatio as VideoAspectRatio) || "Auto"
  );
  const [resolution, setResolution] = useState<VideoResolutionOption>(
    (initialParameters?.resolution as VideoResolutionOption) ||
      formatVideoResolution(defaultOption.resolution)
  );
  const [duration, setDuration] = useState<VideoModelOption["duration"]>(
    initialParameters?.duration || defaultOption.duration
  );


  const localActiveGenerationCountRef = useRef(activeGenerationCount ?? 0);

  const capabilityChangeRef = useRef(onInputCapabilityChange);
  const parametersChangeRef = useRef(onParametersChange);
  const initialImagesKey = initialImages?.join("\u0000");

  const updatePrompt = (value: string) => {
    setPrompt(value);
    onPromptChange?.(value);
  };

  const updateImages = (urls: string[]) => {
    setUploadedImages(urls);
    onInputImagesChange?.(urls);
  };

  const modelNameOptions = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const option of VIDEO_MODEL_OPTIONS) {

      const name = getVideoModelName(option);
      if (!seen.has(name)) { seen.add(name); names.push(name); }
    }
    return names;
  }, []);

  const optionsForModel = useMemo(
    () =>
      VIDEO_MODEL_OPTIONS.filter(
        (o) =>
          getVideoModelName(o) === selectedModelName &&
          DEFAULT_VIDEO_RESOLUTIONS.includes(formatVideoResolution(o.resolution)) &&
          !(o.family === "wan" && hasVideoInput && o.duration > 15)
      ),
    [selectedModelName, hasVideoInput]
  );

  const followsImage = videoFollowsInputRatio(selectedModelName, inputImageCount);
  const aspectRatioOptions = useMemo(() => followsImage ? ["Auto" as VideoAspectRatio] : getDisplayAspectRatios(optionsForModel), [optionsForModel, followsImage]);
  const resolutionOptions = useMemo(
    () => getDisplayResolutions(optionsForModel),
    [optionsForModel]
  );
  const durationOptions = useMemo(
    () => [...new Set(optionsForModel.map((o) => o.duration))].sort((a, b) => a - b),
    [optionsForModel]
  );
  const inputCapabilities = useMemo(
    () => getVideoInputCapabilities(selectedModelName),
    [selectedModelName]
  );
  const imagesOverLimit = inputImageCount > inputCapabilities.maxImages || (inputCapabilities.imageRequired && inputImageCount === 0);

  const selectedOption = optionsForModel.find(o => formatVideoResolution(o.resolution) === resolution && o.duration === duration);
  const showSound = !!selectedOption?.hasAudio;
  const sound = showSound ? "On" : "Off";
  const usesConcurrentGenerationLimit = activeGenerationCount !== undefined;
  const generationLimitReached = usesConcurrentGenerationLimit
    ? activeGenerationCount >= maxConcurrentGenerations
    : isGenerating;

  useEffect(() => {
    if (modelNameOptions.length > 0 && !modelNameOptions.includes(selectedModelName))
      setSelectedModelName(modelNameOptions[0]);
  }, [modelNameOptions, selectedModelName]);
  useEffect(() => {
    const changes: string[] = [];
    if (resolutionOptions.length && !resolutionOptions.includes(resolution)) {
      setResolution(resolutionOptions[0]); changes.push(`resolution to ${resolutionOptions[0]}`);
    }
    if (durationOptions.length && !durationOptions.includes(duration)) {
      setDuration(durationOptions[0]); changes.push(`duration to ${durationOptions[0]}s`);
    }
    if (aspectRatioOptions.length && !aspectRatioOptions.includes(aspectRatio)) {
      setAspectRatio(aspectRatioOptions[0]); changes.push(`aspect ratio to ${followsImage ? "follow the input image" : aspectRatioOptions[0]}`);
    }
    if (changes.length) setSettingsNotice(`Adjusted ${changes.join(", ")} to match this model and its inputs.`);
  }, [resolutionOptions, resolution, durationOptions, duration, aspectRatioOptions, aspectRatio, followsImage]);
  useEffect(() => {
    if (activeGenerationCount !== undefined) {
      localActiveGenerationCountRef.current = activeGenerationCount;
    }
  }, [activeGenerationCount]);
  useEffect(() => { if (initialPrompt !== undefined) setPrompt(initialPrompt); }, [initialPrompt]);
  useEffect(() => {
    if (initialImagesKey !== undefined) {
      setUploadedImages(initialImagesKey ? initialImagesKey.split("\u0000") : []);
    } else if (initialImage !== undefined) {
      setUploadedImages(initialImage ? [initialImage] : []);
    }
  }, [initialImage, initialImagesKey]);
  useEffect(() => { capabilityChangeRef.current = onInputCapabilityChange; }, [onInputCapabilityChange]);
  useEffect(() => { parametersChangeRef.current = onParametersChange; }, [onParametersChange]);
  useEffect(() => {
    capabilityChangeRef.current?.(inputCapabilities);
  }, [inputCapabilities]);
  useEffect(() => {
    parametersChangeRef.current?.({
      model: selectedModelName,
      resolution,
      aspectRatio,
      duration,
      audio: showSound ? sound : undefined,
    });
  }, [aspectRatio, duration, resolution, selectedModelName, showSound, sound]);

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
        { mediaType: "video" }
      );
      showToast({
        title: display.title,
        message: `${display.message} ${display.action}`,
        variant: "warning",
      });
    },
  });

  const pollGenerationStatus = async (params: {
    taskId: string;
    modelOptionId: string;
    prompt: string;
    optimisticId: string;
    creditsCost: number;
    parameters: GenerationParameters;
  }) => {
    const operation = (captureGeneration || capture)();
    const data = await pollGenerationResult({
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      assertCurrent: operation.assertCurrent,
      read: () => axios.get("/api/veo/generate", {
        headers: operation.headers,
        signal: operation.signal,
        params: {
          taskId: params.taskId,
          modelOptionId: params.modelOptionId,
        },
      }),
    });
        trackEvent("generation_success", {
          type: "video",
          model_option_id: data.modelOptionId || params.modelOptionId,
          credits_cost: data.creditsCost || params.creditsCost,
        });
        onGenerate(
          data.videoUrl,
          data.taskId || params.taskId,
          data.prompt || params.prompt,
          params.optimisticId,
          data.parameters || params.parameters,
          data.inputUrls
        );
  };

  const handleGenerate = async () => {
    if (submissionBlocked || imagesOverLimit) return;
    if (status === "loading") {
      return;
    }
    if (!session?.user) {
      trackEvent("signup_started", {
        source: "ai_video_generate",
      });
      await signInForCurrentEnvironment();
      return;
    }
    if (!prompt.trim()) {
      const display = getGenerationErrorDisplay(
        { errorCode: "prompt_required" },
        { mediaType: "video" }
      );
      showToast({
        title: display.title,
        message: `${display.message} ${display.action}`,
        variant: "warning",
      });
      return;
    }
    if (!selectedOption) {
      showToast({
        title: "Invalid settings",
        message: "Invalid model settings, please adjust and try again.",
        variant: "warning",
      });
      return;
    }
    if (
      generationLimitReached ||
      (usesConcurrentGenerationLimit &&
        localActiveGenerationCountRef.current >= maxConcurrentGenerations)
    ) {
      showToast({
        title: "Generation limit reached",
        message: `You can run up to ${maxConcurrentGenerations} video generations at once.`,
        variant: "warning",
      });
      return;
    }
    if (usesConcurrentGenerationLimit) {
      localActiveGenerationCountRef.current += 1;
    }
    const requestPrompt = prompt.trim();
    const optimisticId = `local-video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const generationParameters: GenerationParameters = {
      model: getVideoModelName(selectedOption),
      resolution,
      aspectRatio,
      duration,
      audio: showSound ? (sound === "Off" ? "Off" : "On") : undefined,
      inputKinds: requestInputs.map((input) => input.kind),
      mode: requestInputs.some((input) => input.kind !== "image")
        ? "Multimodal reference to video"
        : uploadedImages.length === 2
        ? "First and last frame to video"
        : uploadedImages.length === 1
          ? "Image to video"
          : "Text to video",
    };
    onGenerationStart?.({
      optimisticId,
      prompt: requestPrompt,
      parameters: generationParameters,
    });
    updatePrompt("");
    updateImages([]);
    onInputAttachmentsChange?.([]);
    setIsGenerating?.(true);
    const requestAspectRatio = aspectRatio === "Auto" ? undefined : aspectRatio;
    trackEvent("generation_started", {
      type: "video",
      model_option_id: selectedOption.id,
      model: selectedOption.providerModel,
      credits_cost: selectedOption.credits,
      aspect_ratio: aspectRatio,
    });
    let accepted = false;
    try {
      const operation = (captureGeneration || capture)();
      const response = await axios.post("/api/veo/generate", {
        prompt: requestPrompt,
        inputs: requestInputs.length > 0 ? requestInputs : undefined,
        modelOptionId: selectedOption.id,
        aspectRatio: requestAspectRatio,
        generateAudio: showSound ? sound !== "Off" : false,
        runId: optimisticId,
      }, { headers: operation.headers, signal: operation.signal });
      operation.assertCurrent();
      if (response.data.success) {
        const taskId = response.data.taskId;
        const responsePrompt = response.data.prompt || prompt;
        if (taskId && onTaskIdChange) onTaskIdChange(taskId);
        if (response.data.pending && taskId) {
          accepted = true;
          onGenerationTaskCreated?.({
            optimisticId,
            taskId,
            prompt: responsePrompt,
            inputUrls: response.data.inputUrls,
          });
          await pollGenerationStatus({
            taskId,
            modelOptionId: response.data.modelOptionId || selectedOption.id,
            prompt: responsePrompt,
            optimisticId,
            creditsCost: response.data.creditsCost || selectedOption.credits,
            parameters: response.data.parameters || generationParameters,
          });
          return;
        }

        if (response.data.videoUrl) {
          trackEvent("generation_success", {
            type: "video",
            model_option_id: response.data.modelOptionId || selectedOption.id,
            credits_cost: response.data.creditsCost || selectedOption.credits,
          });
          onGenerate(
            response.data.videoUrl,
            taskId,
            responsePrompt,
            optimisticId,
            response.data.parameters || generationParameters,
            response.data.inputUrls
          );
          return;
        }

        throw new Error("Generation did not return a video URL.");
      } else throw { response };
    } catch (error: any) {
      if (isAccountOperationCancelled(error)) return;
      if (!isConfirmedGenerationFailure(error, accepted)) {
        onGenerationUncertain?.({ optimisticId });
        showToast({ title: "Status unavailable", message: GENERATION_STATUS_UNAVAILABLE, variant: "warning" });
        return;
      }
      const errorDisplay = getGenerationErrorDisplay(
        error.response?.data || error,
        { mediaType: "video", status: error.response?.status }
      );
      const message = errorDisplay.message;
      if (error.response?.status === 402) {
        trackEvent("insufficient_credits_shown", {
          type: "video",
          required: error.response?.data?.required,
          available: error.response?.data?.available,
        });
      }
      trackEvent("generation_failed", {
        type: "video",
        model_option_id: selectedOption.id,
        error: errorDisplay.code,
      });
      onGenerationFailure?.({
        optimisticId,
        prompt: requestPrompt,
        error: message,
        errorCode: errorDisplay.code,
      });
      showToast({
        title: errorDisplay.title,
        message: `${message} ${errorDisplay.action}`,
        variant: errorDisplay.retryable ? "error" : "warning",
      });
    } finally {
      if (usesConcurrentGenerationLimit) {
        localActiveGenerationCountRef.current = Math.max(
          0,
          localActiveGenerationCountRef.current - 1
        );
      }
      setIsGenerating?.(false);
    }
  };

  // ── Trigger button shared class ──────────────────────────────────────────
  const settingsControl = <GenerationSettings placement={menuPlacement} models={modelNameOptions.map(name => ({ id: name, label: name }))} model={selectedModelName} onModel={setSelectedModelName} ratios={aspectRatioOptions} ratio={aspectRatio} onRatio={v => setAspectRatio(v as VideoAspectRatio)} resolutions={resolutionOptions} resolution={resolution} onResolution={v => setResolution(v as VideoResolutionOption)} durations={durationOptions} duration={duration} onDuration={setDuration} followsImage={followsImage} notice={[settingsNotice, hasVideoInput && selectedModelName === "Wan 3.0 Video" ? "With a reference video, output is limited to 15 seconds." : ""].filter(Boolean).join(" ")} />;

  if (variant === "composer") {
    return (
      <div className="mt-2 space-y-2">
        <div className="relative h-20">
          <Textarea
            value={prompt}
            onChange={(event) => updatePrompt(event.target.value)}
            placeholder="Describe the video you want to create..."
            className="h-20 min-h-20 resize-none border-0 bg-transparent px-1 pb-1 pt-1 shadow-none focus-visible:ring-0"
            maxLength={500}
          />
        </div>
        <div className="flex min-h-12 items-start gap-1 border-t border-border pt-2">
          {toolbarLeading}
          {settingsControl}
          <Button type="button" onClick={handleGenerate} disabled={status === "loading" || (!!session && (generationLimitReached || !prompt.trim() || !selectedOption || submissionBlocked || imagesOverLimit))} className="ml-auto h-10 gap-2 px-4">
            {!session ? getSignInLabel() : <><span>{selectedOption?.credits ?? 0} credits</span><Send className="h-4 w-4" /></>}
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
        <textarea
          value={prompt}
          onChange={(e) => updatePrompt(e.target.value)}
          placeholder="Describe the video you want to create..."
          className="h-36 w-full resize-none rounded-2xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground shadow-sm transition-all duration-300 placeholder:text-muted-foreground focus:border-input focus:outline-none focus:ring-2 focus:ring-input"
          maxLength={500}
        />
      </div>

      <div className="space-y-4">
        <div className="flex">{settingsControl}</div>

        <Button
          onClick={handleGenerate}
          disabled={
            status === "loading" ||
            (!!session && (generationLimitReached || !prompt.trim() || !selectedOption || imagesOverLimit))
          }
          className="w-full rounded-xl border-0 bg-primary text-primary-foreground shadow-sm transition-all duration-300 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
          size="lg"
        >
          {status === "loading" ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Checking session...</>
          ) : !session ? (
            getSignInLabel()
          ) : usesConcurrentGenerationLimit && generationLimitReached ? (
            `Generating ${maxConcurrentGenerations}/${maxConcurrentGenerations}`
          ) : isGenerating ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Generating...</>
          ) : "Generate"}
        </Button>

        <p className="text-xs text-muted-foreground">
          This generation will cost {selectedOption?.credits ?? 0} credits.
        </p>
      </div>
    </div>
  );
}
