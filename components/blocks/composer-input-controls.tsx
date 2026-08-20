"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FileAudio,
  Image as ImageIcon,
  Plus,
  Video,
  X,
} from "lucide-react";
import { useToast } from "@/components/blocks/app-toast-provider";
import type {
  ComposerAttachmentKind,
  GenerationInputCapabilities,
} from "@/lib/generation-input-capabilities";

export type ActiveComposerType = "image" | "video";

export interface ComposerAttachment {
  id: string;
  url: string;
  kind: ComposerAttachmentKind;
  name: string;
  source: "upload" | "asset" | "reference";
}

export interface ComposerAssetOption {
  id: string;
  url: string;
  kind: ComposerAttachmentKind;
  name: string;
}

function createAttachmentId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function mediaLabel(kind: ComposerAttachmentKind) {
  if (kind === "audio") return "Audio";
  return kind[0].toUpperCase() + kind.slice(1);
}

export function ComposerAttachments({
  attachments,
  capabilities,
  onRemove,
}: {
  attachments: ComposerAttachment[];
  capabilities: GenerationInputCapabilities;
  onRemove: (id: string) => void;
}) {
  if (attachments.length === 0) return null;

  let imageIndex = 0;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Prompt attachments">
      {attachments.map((attachment) => {
        const currentImageIndex = attachment.kind === "image" ? imageIndex++ : -1;
        const compatible =
          attachment.kind === "image"
            ? currentImageIndex < capabilities.maxImages
            : attachment.kind === "video"
              ? capabilities.acceptsVideo
              : capabilities.acceptsAudio;
        const role =
          attachment.kind === "image"
            ? capabilities.imageRoles[currentImageIndex] || `Reference ${currentImageIndex + 1}`
            : mediaLabel(attachment.kind);

        return (
          <div
            key={attachment.id}
            className={`relative flex h-14 w-36 shrink-0 items-center gap-2 rounded-ui border p-1.5 transition-all duration-300 ${
              compatible
                ? "border-border bg-surface-soft/60"
                : "border-destructive/30 bg-destructive/5"
            }`}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-ui bg-background">
              {attachment.kind === "image" ? (
                <img src={attachment.url} alt="" className="h-full w-full object-cover" />
              ) : attachment.kind === "video" ? (
                <Video className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FileAudio className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 pr-4">
              <p className="truncate text-[11px] font-medium text-foreground">{role}</p>
              <p className={`truncate text-[10px] ${compatible ? "text-muted-foreground" : "text-destructive"}`}>
                {compatible ? attachment.name : "Not supported"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(attachment.id)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-background hover:text-foreground"
              aria-label={`Remove ${attachment.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ComposerToolbarLeading({
  composerType,
  capabilities,
  attachments,
  assets,
  onTypeChange,
  onAdd,
}: {
  composerType: ActiveComposerType;
  capabilities: GenerationInputCapabilities;
  attachments: ComposerAttachment[];
  assets: ComposerAssetOption[];
  onTypeChange: (type: ActiveComposerType) => void;
  onAdd: (attachments: ComposerAttachment[]) => void;
}) {
  const { showToast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [assetView, setAssetView] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const addRootRef = useRef<HTMLDivElement | null>(null);
  const typeRootRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const imageCount = attachments.filter((attachment) => attachment.kind === "image").length;
  const availableImageSlots = Math.max(0, capabilities.maxImages - imageCount);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!addRootRef.current?.contains(target)) {
        setAddOpen(false);
        setAssetView(false);
      }
      if (!typeRootRef.current?.contains(target)) setTypeOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAddOpen(false);
        setAssetView(false);
        setTypeOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const handleImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const candidates = Array.from(files);
    const tooLarge = candidates.find((file) => file.size > capabilities.maxImageBytes);
    if (tooLarge) {
      showToast({
        title: "Image is too large",
        message: `The current model accepts images up to ${Math.round(capabilities.maxImageBytes / 1024 / 1024)} MB each.`,
        variant: "warning",
      });
      return;
    }
    if (availableImageSlots === 0) {
      showToast({
        title: "Image limit reached",
        message: `The current model accepts up to ${capabilities.maxImages} ${capabilities.maxImages === 1 ? "image" : "images"}.`,
        variant: "warning",
      });
      return;
    }
    const accepted = candidates.slice(0, availableImageSlots);
    if (accepted.length < candidates.length) {
      showToast({
        title: "Some images were not added",
        message: `The current model accepts up to ${capabilities.maxImages} images.`,
        variant: "warning",
      });
    }
    const urls = await Promise.all(accepted.map(readFileAsDataUrl));
    onAdd(
      accepted.map((file, index) => ({
        id: createAttachmentId("upload"),
        url: urls[index],
        kind: "image" as const,
        name: file.name,
        source: "upload" as const,
      }))
    );
    setAddOpen(false);
    setAssetView(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const chooseAsset = (asset: ComposerAssetOption) => {
    const duplicate = attachments.some((attachment) => attachment.url === asset.url);
    const supported =
      asset.kind === "image"
        ? availableImageSlots > 0
        : asset.kind === "video"
          ? capabilities.acceptsVideo
          : capabilities.acceptsAudio;
    if (duplicate || !supported) return;
    onAdd([
      {
        id: createAttachmentId("asset"),
        url: asset.url,
        kind: asset.kind,
        name: asset.name,
        source: "asset",
      },
    ]);
  };

  return (
    <>
      <div ref={addRootRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setAddOpen((current) => !current);
            setAssetView(false);
            setTypeOpen(false);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Add input"
          aria-expanded={addOpen}
        >
          <Plus className="h-4 w-4" />
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="sr-only"
          onChange={(event) => void handleImages(event.target.files)}
        />
        {addOpen && (
          <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-ui-lg border border-border bg-background shadow-float">
            {assetView ? (
              <div>
                <div className="flex items-center gap-2 border-b border-border px-2 py-2">
                  <button
                    type="button"
                    onClick={() => setAssetView(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground"
                    aria-label="Back to upload options"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <p className="text-xs font-medium text-foreground">Choose from Assets</p>
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto p-2">
                  {assets.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">No generated assets yet.</p>
                  ) : (
                    assets.map((asset) => {
                      const duplicate = attachments.some((attachment) => attachment.url === asset.url);
                      const supported =
                        asset.kind === "image"
                          ? availableImageSlots > 0
                          : asset.kind === "video"
                            ? capabilities.acceptsVideo
                            : capabilities.acceptsAudio;
                      const reason = duplicate
                        ? "Already added"
                        : supported
                          ? "Add to prompt"
                          : `Current model doesn’t support ${asset.kind} input`;
                      return (
                        <button
                          key={`${asset.id}-${asset.url}`}
                          type="button"
                          onClick={() => chooseAsset(asset)}
                          disabled={!supported || duplicate}
                          className="flex w-full items-center gap-2 rounded-ui px-2 py-2 text-left transition-all duration-300 hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-ui bg-surface-soft">
                            {asset.kind === "image" ? (
                              <img src={asset.url} alt="" className="h-full w-full object-cover" />
                            ) : asset.kind === "video" ? (
                              <Video className="h-4 w-4" />
                            ) : (
                              <FileAudio className="h-4 w-4" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-foreground">{asset.name}</span>
                            <span className="block truncate text-[10px] text-muted-foreground">{reason}</span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="p-2">
                <p className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">Upload from device</p>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={availableImageSlots === 0}
                  className="flex w-full items-center gap-3 rounded-ui px-2 py-2 text-left transition-all duration-300 hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
                >
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-foreground">Image</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {availableImageSlots > 0
                        ? `${availableImageSlots} ${availableImageSlots === 1 ? "slot" : "slots"} available`
                        : `Current model accepts up to ${capabilities.maxImages} images`}
                    </span>
                  </span>
                </button>
                <DisabledMediaRow kind="video" supported={capabilities.acceptsVideo} />
                <DisabledMediaRow kind="audio" supported={capabilities.acceptsAudio} />
                <div className="my-1 border-t border-border" />
                <button
                  type="button"
                  onClick={() => setAssetView(true)}
                  className="flex w-full items-center gap-3 rounded-ui px-2 py-2 text-left transition-all duration-300 hover:bg-surface-soft"
                >
                  <span className="flex h-4 w-4 items-center justify-center text-muted-foreground">@</span>
                  <span>
                    <span className="block text-xs font-medium text-foreground">Choose from Assets</span>
                    <span className="block text-[10px] text-muted-foreground">Use a previous result</span>
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={typeRootRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setTypeOpen((current) => !current);
            setAddOpen(false);
            setAssetView(false);
          }}
          className="flex h-9 items-center gap-1.5 rounded-ui px-2 text-xs font-medium text-foreground transition-all duration-300 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Generation type"
          aria-expanded={typeOpen}
        >
          {composerType === "image" ? <ImageIcon className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          <span>{composerType === "image" ? "Image" : "Video"}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {typeOpen && (
          <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-50 w-36 rounded-ui-lg border border-border bg-background p-1 shadow-float">
            {(["image", "video"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  onTypeChange(type);
                  setTypeOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-ui px-2 py-2 text-xs text-foreground transition-all duration-300 hover:bg-surface-soft"
              >
                <Check className={`h-3.5 w-3.5 ${composerType === type ? "text-foreground" : "text-transparent"}`} />
                {type === "image" ? <ImageIcon className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                <span>{type === "image" ? "Image" : "Video"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function DisabledMediaRow({
  kind,
  supported,
}: {
  kind: "video" | "audio";
  supported: boolean;
}) {
  const Icon = kind === "video" ? Video : FileAudio;
  return (
    <button
      type="button"
      disabled={!supported}
      className="flex w-full items-center gap-3 rounded-ui px-2 py-2 text-left transition-all duration-300 hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block text-xs font-medium text-foreground">{mediaLabel(kind)}</span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {supported ? "Supported" : `Current model doesn’t support ${kind} input`}
        </span>
      </span>
    </button>
  );
}
