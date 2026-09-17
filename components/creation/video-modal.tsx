"use client";

import { MediaPreviewModal } from "@/components/ui/media-preview-modal";

interface VideoModalProps {
  videoUrl: string;
  onClose: () => void;
}

export default function VideoModal({ videoUrl, onClose }: VideoModalProps) {
  return <MediaPreviewModal url={videoUrl} type="video" alt="Preview" onClose={onClose} />;
}
