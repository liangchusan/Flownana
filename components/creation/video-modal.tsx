"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface VideoModalProps {
  videoUrl: string;
  onClose: () => void;
}

export default function VideoModal({ videoUrl, onClose }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    // 自动播放视频
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 transition-all duration-300 hover:bg-white"
        >
          <X className="h-6 w-6 text-stone-900" />
        </button>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="max-h-full max-w-full rounded-xl object-contain"
          autoPlay
        />
      </div>
    </div>
  );
}
