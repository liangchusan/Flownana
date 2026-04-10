"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Loader2, Upload, X } from "lucide-react";
import axios from "axios";
import {
  VIDEO_MODEL_OPTION_MAP,
  VIDEO_MODEL_OPTIONS,
  type VideoModelOption,
} from "@/lib/generation-pricing";

const getModelName = (option: VideoModelOption): string => {
  if (option.family === "kling") return "Kling 3.0";
  if (option.family === "seedance") return "Seedance 1.5 Pro";
  if (option.providerModel === "veo3_lite") return "VEO 3.1 Lite";
  if (option.providerModel === "veo3_fast") return "VEO 3.1 Fast";
  return "VEO 3.1 Quality";
};

const formatResolution = (resolution: VideoModelOption["resolution"]): string =>
  resolution === "/" ? "Auto" : resolution;

const MODEL_POPUP_CLS =
  "absolute bottom-[calc(100%+0.5rem)] left-0 z-50 rounded-xl border border-stone-200/50 bg-white shadow-lg";
const OPTIONS_POPUP_CLS =
  "absolute bottom-[calc(100%+0.5rem)] right-0 z-50 rounded-xl border border-stone-200/50 bg-white shadow-lg";

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
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState<string>(formatResolution(defaultOption.resolution));
  const [duration, setDuration] = useState<VideoModelOption["duration"]>(defaultOption.duration);
  const [sound, setSound] = useState<"on" | "off">(defaultOption.hasAudio ? "on" : "off");

  const [modelOpen, setModelOpen] = useState(false);
  const modelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const modelPopupRef = useRef<HTMLDivElement | null>(null);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const optionsPopupRef = useRef<HTMLDivElement | null>(null);

  const modelNameOptions = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const option of VIDEO_MODEL_OPTIONS) {
      const name = getModelName(option);
      if (!seen.has(name)) { seen.add(name); names.push(name); }
    }
    return names;
  }, []);

  const optionsForModel = useMemo(
    () => VIDEO_MODEL_OPTIONS.filter((o) => getModelName(o) === selectedModelName),
    [selectedModelName]
  );

  const aspectRatioOptions = useMemo(() => ["16:9", "9:16", "1:1", "4:3"], []);
  const resolutionOptions = useMemo(
    () => [...new Set(optionsForModel.map((o) => formatResolution(o.resolution)))],
    [optionsForModel]
  );
  const durationOptions = useMemo(
    () => [...new Set(optionsForModel.map((o) => o.duration))].sort((a, b) => a - b),
    [optionsForModel]
  );
  const soundOptions = useMemo(
    () => [...new Set(optionsForModel.map((o) => (o.hasAudio ? "on" : "off")))] as Array<"on" | "off">,
    [optionsForModel]
  );
  const showSound = soundOptions.length > 1 || soundOptions[0] === "on";

  const selectedOption = useMemo(() => {
    return (
      optionsForModel.find(
        (o) =>
          formatResolution(o.resolution) === resolution &&
          o.duration === duration &&
          (o.hasAudio ? "on" : "off") === sound
      ) ??
      optionsForModel.find(
        (o) => formatResolution(o.resolution) === resolution && o.duration === duration
      ) ??
      optionsForModel[0]
    );
  }, [duration, optionsForModel, resolution, sound]);

  useEffect(() => {
    if (modelNameOptions.length > 0 && !modelNameOptions.includes(selectedModelName))
      setSelectedModelName(modelNameOptions[0]);
  }, [modelNameOptions, selectedModelName]);
  useEffect(() => {
    if (resolutionOptions.length > 0 && !resolutionOptions.includes(resolution))
      setResolution(resolutionOptions[0]);
  }, [resolutionOptions, resolution]);
  useEffect(() => {
    if (durationOptions.length > 0 && !durationOptions.includes(duration))
      setDuration(durationOptions[0]);
  }, [durationOptions, duration]);
  useEffect(() => {
    if (soundOptions.length > 0 && !soundOptions.includes(sound))
      setSound(soundOptions[0]);
  }, [soundOptions, sound]);
  useEffect(() => { if (initialPrompt !== undefined) setPrompt(initialPrompt); }, [initialPrompt]);
  useEffect(() => { if (initialImage !== undefined) setUploadedImage(initialImage); }, [initialImage]);

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
    onDrop: (files) => {
      if (files.length > 0) {
        const reader = new FileReader();
        reader.onload = () => setUploadedImage(reader.result as string);
        reader.readAsDataURL(files[0]);
      }
    },
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) { alert("Please enter a prompt"); return; }
    if (!selectedOption) { alert("Invalid model settings, please adjust and try again."); return; }
    setIsGenerating(true);
    try {
      const response = await axios.post("/api/veo/generate", {
        prompt,
        imageUrls: uploadedImage ? [uploadedImage] : undefined,
        modelOptionId: selectedOption.id,
        aspectRatio,
      });
      if (response.data.success) {
        const taskId = response.data.taskId;
        const responsePrompt = response.data.prompt || prompt;
        if (taskId && onTaskIdChange) onTaskIdChange(taskId);
        onGenerate(response.data.videoUrl, taskId, responsePrompt);
      } else {
        alert("Generation failed, please try again");
      }
    } catch (error: any) {
      alert(error.response?.data?.error || "Generation failed, please try again");
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Trigger button shared class ──────────────────────────────────────────
  const triggerCls =
    "flex h-full w-full items-center justify-between rounded-xl border border-stone-200/50 bg-white px-3 py-[7px] text-left text-xs text-stone-900 transition-all duration-300 hover:border-stone-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-500";

  // ── Option chip shared class ─────────────────────────────────────────────
  const chipCls = (active: boolean) =>
    `rounded-xl border px-3 py-1.5 text-sm font-medium transition-all duration-300 active:scale-[0.98] ${
      active
        ? "border-stone-300 bg-stone-100 text-stone-900"
        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
    }`;

  // ── Model popup ──────────────────────────────────────────────────────────
  const modelPopup = modelOpen && (
    <div
      ref={modelPopupRef}
      className={`${MODEL_POPUP_CLS} w-56 max-w-[calc(100vw-2rem)] py-1.5`}
    >
      <p className="px-3 pb-1.5 pt-1 text-xs font-medium text-stone-400">Model</p>
      {modelNameOptions.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => { setSelectedModelName(name); setModelOpen(false); }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-all duration-300 ${
            selectedModelName === name
              ? "bg-stone-100 text-stone-900"
              : "text-stone-700 hover:bg-stone-50"
          }`}
        >
          <Check className={`h-3.5 w-3.5 shrink-0 ${selectedModelName === name ? "text-stone-500" : "text-transparent"}`} />
          {name}
        </button>
      ))}
    </div>
  );

  // ── Options popup ────────────────────────────────────────────────────────
  const optionsPopup = optionsOpen && (
    <div
      ref={optionsPopupRef}
      className={`${OPTIONS_POPUP_CLS} w-72 max-w-[calc(100vw-2rem)] px-4 py-3`}
    >
      <div className="divide-y divide-stone-100">
        <div className="pb-3">
          <p className="mb-2 text-xs font-medium text-stone-400">Aspect Ratio</p>
          <div className="flex flex-wrap gap-1.5">
            {aspectRatioOptions.map((r) => (
              <button key={r} type="button" onClick={() => setAspectRatio(r)} className={chipCls(aspectRatio === r)}>{r}</button>
            ))}
          </div>
        </div>

        <div className="py-3">
          <p className="mb-2 text-xs font-medium text-stone-400">Resolution</p>
          <div className="flex flex-wrap gap-1.5">
            {resolutionOptions.length > 0
              ? resolutionOptions.map((r) => (
                  <button key={r} type="button" onClick={() => setResolution(r)} className={chipCls(resolution === r)}>{r}</button>
                ))
              : <span className="text-sm text-stone-400">Auto</span>}
          </div>
        </div>

        <div className={showSound ? "py-3" : "pt-3"}>
          <p className="mb-2 text-xs font-medium text-stone-400">Length</p>
          <div className="flex flex-wrap gap-1.5">
            {durationOptions.length > 0
              ? durationOptions.map((d) => (
                  <button key={d} type="button" onClick={() => setDuration(d)} className={chipCls(duration === d)}>{d}s</button>
                ))
              : <span className="text-sm text-stone-400">—</span>}
          </div>
        </div>

        {showSound && (
          <div className="pt-3">
            <p className="mb-2 text-xs font-medium text-stone-400">Native Audio</p>
            <div className="flex flex-wrap gap-1.5">
              {soundOptions.map((s) => (
                <button key={s} type="button" onClick={() => setSound(s)} className={chipCls(sound === s)}>
                  {s === "on" ? "On" : "Off"}
                </button>
              ))}
            </div>
          </div>
        )}
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
          placeholder="Describe the video you want to create..."
          className="h-36 w-full resize-none rounded-2xl border border-stone-200/50 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition-all duration-300 placeholder:text-stone-400 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-300"
          maxLength={500}
        />
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-24 flex-[1.25]">
            <button ref={modelTriggerRef} type="button" onClick={openModel} className={triggerCls}>
              <span className="truncate">{selectedModelName}</span>
              <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-stone-500" />
            </button>
            {modelPopup}
          </div>
          <div className="relative min-w-44 flex-[1.75]">
            <button ref={optionsTriggerRef} type="button" onClick={openOptions} className={triggerCls}>
              <span className="truncate">
                {aspectRatio} | {resolution} | {duration}s{showSound && sound === "on" ? " | Audio" : ""}
              </span>
              <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-stone-500" />
            </button>
            {optionsPopup}
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim() || !selectedOption}
          className="w-full rounded-xl border-0 bg-stone-800 text-white shadow-sm transition-all duration-300 hover:bg-stone-800/90 active:scale-[0.98] disabled:opacity-50"
          size="lg"
        >
          {isGenerating ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Generating...</>
          ) : "Generate"}
        </Button>

        <p className="text-xs text-stone-600">
          This generation will cost {selectedOption?.credits ?? 0} credits.
        </p>
      </div>
    </div>
  );
}
