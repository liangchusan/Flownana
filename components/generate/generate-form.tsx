"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Upload, X, Loader2 } from "lucide-react";
import axios from "axios";
import {
  IMAGE_RESOLUTION_CREDITS,
  type ImageResolutionKey,
} from "@/lib/generation-pricing";

// Shared popup container class
const POPUP_CLS =
  "fixed z-[9999] rounded-xl border border-slate-200/60 bg-white shadow-lg";

interface GenerateFormProps {
  onGenerate: (imageUrl: string, taskId?: string, prompt?: string) => void;
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
  onTaskIdChange?: (taskId: string) => void;
  initialPrompt?: string;
  initialImage?: string;
}

export function GenerateForm({
  onGenerate,
  isGenerating,
  setIsGenerating,
  onTaskIdChange,
  initialPrompt,
  initialImage,
}: GenerateFormProps) {
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [uploadedImage, setUploadedImage] = useState<string | null>(initialImage || null);
  const [model, setModel] = useState("nano-banana-2");
  const [resolution, setResolution] = useState<ImageResolutionKey>("1K");
  const [aspectRatio, setAspectRatio] = useState("1:1");

  const [modelOpen, setModelOpen] = useState(false);
  const [modelPos, setModelPos] = useState<{ bottom: number; left: number } | null>(null);
  const modelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const modelPopupRef = useRef<HTMLDivElement | null>(null);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionsPos, setOptionsPos] = useState<{ bottom: number; left: number } | null>(null);
  const optionsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const optionsPopupRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const imageModels = useMemo(
    () => [{ id: "nano-banana-2", label: "Nano Banana 2" }],
    []
  );
  const ratioOptions = useMemo(() => ["1:1", "16:9", "9:16", "4:3", "3:4"], []);
  const resolutionOptions = useMemo(() => ["1K", "2K", "4K"] as ImageResolutionKey[], []);

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
    if (modelTriggerRef.current) {
      const rect = modelTriggerRef.current.getBoundingClientRect();
      const w = Math.min(220, window.innerWidth - 16);
      setModelPos({ bottom: window.innerHeight - rect.top + 8, left: Math.max(8, rect.right - w) });
    }
    setModelOpen((p) => !p);
    setOptionsOpen(false);
  };

  const openOptions = () => {
    if (optionsTriggerRef.current) {
      const rect = optionsTriggerRef.current.getBoundingClientRect();
      const w = Math.min(280, window.innerWidth - 16);
      setOptionsPos({ bottom: window.innerHeight - rect.top + 8, left: Math.max(8, rect.right - w) });
    }
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
    setIsGenerating(true);
    try {
      const mode = uploadedImage ? "image-to-image" : "text-to-image";
      const response = await axios.post("/api/generate", {
        prompt, imageUrl: uploadedImage, mode, model, resolution, aspectRatio,
      });
      if (response.data.success) {
        const taskId = response.data.taskId;
        const responsePrompt = response.data.prompt || prompt;
        if (taskId && onTaskIdChange) onTaskIdChange(taskId);
        onGenerate(response.data.imageUrl, taskId, responsePrompt);
      } else {
        alert("Generation failed, please try again");
      }
    } catch (error: any) {
      alert(error.response?.data?.error || error.message || "Generation failed, please try again");
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Shared classes ───────────────────────────────────────────────────────
  const triggerCls =
    "flex h-full w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-[7px] text-left text-xs text-slate-900 transition-colors hover:border-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500";

  const chipCls = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
      active
        ? "border-slate-400 bg-slate-100 text-slate-900"
        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
    }`;

  const currentModelLabel = imageModels.find((m) => m.id === model)?.label ?? model;

  // ── Model popup ──────────────────────────────────────────────────────────
  const modelPopup = modelOpen && modelPos && (
    <div
      ref={modelPopupRef}
      className={`${POPUP_CLS} w-[min(220px,calc(100vw-2rem))] py-1.5`}
      style={{ bottom: modelPos.bottom, left: modelPos.left }}
    >
      <p className="px-3 pb-1.5 pt-1 text-xs font-medium text-slate-400">Model</p>
      {imageModels.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => { setModel(m.id); setModelOpen(false); }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
            model === m.id
              ? "bg-slate-100 text-slate-900"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Check className={`h-3.5 w-3.5 shrink-0 ${model === m.id ? "text-slate-500" : "text-transparent"}`} />
          {m.label}
        </button>
      ))}
    </div>
  );

  // ── Options popup ────────────────────────────────────────────────────────
  const optionsPopup = optionsOpen && optionsPos && (
    <div
      ref={optionsPopupRef}
      className={`${POPUP_CLS} w-[min(280px,calc(100vw-2rem))] px-4 py-3`}
      style={{ bottom: optionsPos.bottom, left: optionsPos.left }}
    >
      <div className="divide-y divide-slate-100">
        <div className="pb-3">
          <p className="mb-2 text-xs font-medium text-slate-400">Aspect Ratio</p>
          <div className="flex flex-wrap gap-1.5">
            {ratioOptions.map((r) => (
              <button key={r} type="button" onClick={() => setAspectRatio(r)} className={chipCls(aspectRatio === r)}>{r}</button>
            ))}
          </div>
        </div>
        <div className="pt-3">
          <p className="mb-2 text-xs font-medium text-slate-400">Resolution</p>
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
        <label className="block text-sm font-medium text-slate-900">Image</label>
        {uploadedImage ? (
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200/60 bg-slate-50 shadow-sm">
            <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-contain" />
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
              isDragActive ? "border-slate-500 bg-slate-100" : "hover:border-slate-400 hover:bg-slate-100/60"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-9 w-9 text-slate-400 mb-3" />
            <p className="text-slate-600 text-sm">
              {isDragActive ? "Drop image file" : "Click or drop an image to upload"}
            </p>
          </div>
        )}
      </div>

      {/* Prompt */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-900">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate or edit..."
          className="h-36 w-full resize-none rounded-2xl border border-slate-200/60 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-all duration-200 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300"
          maxLength={5000}
        />
      </div>

      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-[1.5]">
            <button ref={modelTriggerRef} type="button" onClick={openModel} className={triggerCls}>
              <span className="truncate">{currentModelLabel}</span>
              <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-slate-500" />
            </button>
          </div>
          <div className="relative flex-1">
            <button ref={optionsTriggerRef} type="button" onClick={openOptions} className={triggerCls}>
              <span className="truncate">{aspectRatio} | {resolution}</span>
              <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-slate-500" />
            </button>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full rounded-full border-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm transition-all duration-200 hover:from-blue-700 hover:to-blue-800 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          size="lg"
        >
          {isGenerating ? (
            <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Generating...</>
          ) : "Generate"}
        </Button>

        <p className="text-xs text-slate-600">
          This generation will cost {IMAGE_RESOLUTION_CREDITS[resolution]} credits.
        </p>
      </div>

      {mounted && modelPopup && createPortal(modelPopup, document.body)}
      {mounted && optionsPopup && createPortal(optionsPopup, document.body)}
    </div>
  );
}
