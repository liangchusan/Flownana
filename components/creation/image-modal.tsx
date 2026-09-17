"use client";

import { MediaPreviewModal } from "@/components/ui/media-preview-modal";

interface ImageModalProps {
  imageUrl: string;
  onClose: () => void;
}

export default function ImageModal({ imageUrl, onClose }: ImageModalProps) {
  return <MediaPreviewModal url={imageUrl} type="image" alt="Preview" onClose={onClose} />;
}
