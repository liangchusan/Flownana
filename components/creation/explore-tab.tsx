"use client";

import { useState, useRef, useEffect } from "react";
import ImageModal from "./image-modal";
import VideoModal from "./video-modal";

interface ExploreTabProps {
  mode: "video" | "image" | "music";
}

// 模拟的官方案例数据
const exploreExamples = [
  {
    id: "1",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "A beautiful sunset over mountains",
  },
  {
    id: "2",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    model: "VEO3",
    prompt: "A peaceful forest scene",
  },
  {
    id: "3",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Abstract geometric patterns",
  },
  {
    id: "4",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    model: "VEO3",
    prompt: "Urban cityscape at night",
  },
  {
    id: "5",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Serene lake reflection",
  },
  {
    id: "6",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    model: "VEO3",
    prompt: "Ocean waves crashing",
  },
  {
    id: "7",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Starry night sky",
  },
  {
    id: "8",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    model: "VEO3",
    prompt: "Mountain hiking trail",
  },
  {
    id: "9",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Desert landscape",
  },
  {
    id: "10",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    model: "VEO3",
    prompt: "Tropical beach paradise",
  },
  {
    id: "11",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Modern architecture",
  },
  {
    id: "12",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    model: "VEO3",
    prompt: "Winter wonderland",
  },
];

export function ExploreTab({ mode }: ExploreTabProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  const handleImageClick = (url: string) => {
    setSelectedImage(url);
  };

  const handleVideoClick = (url: string) => {
    setSelectedVideo(url);
  };

  // 根据 mode 过滤内容（可选，或者显示所有内容）
  const filteredExamples = exploreExamples;

  // 自动播放所有视频（静音、循环）
  useEffect(() => {
    const playAllVideos = async () => {
      Object.values(videoRefs.current).forEach(async (video) => {
        if (video) {
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          try {
            await video.play();
          } catch (error) {
            // 忽略自动播放错误（浏览器策略）
            console.debug("Video autoplay prevented:", error);
          }
        }
      });
    };

    // 延迟一下确保视频元素已渲染
    const timer = setTimeout(playAllVideos, 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="px-6 pb-6">
      <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
        {filteredExamples.map((example) => (
          <div
            key={example.id}
            className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer mb-4 break-inside-avoid"
          >
            {example.type === "image" ? (
              <div
                onClick={() => handleImageClick(example.url)}
                className="bg-gray-100 relative"
              >
                <img
                  src={example.url}
                  alt={example.prompt}
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
            ) : (
              <div 
                className="bg-gray-100 relative cursor-pointer"
                onClick={() => handleVideoClick(example.url)}
              >
                <video
                  ref={(video) => {
                    videoRefs.current[example.id] = video;
                  }}
                  src={example.url}
                  className="w-full h-auto"
                  muted
                  loop
                  playsInline
                  preload="auto"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}

      {/* Video Modal */}
      {selectedVideo && (
        <VideoModal
          videoUrl={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}
