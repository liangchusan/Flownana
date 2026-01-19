"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ImageModal from "./image-modal";
import VideoModal from "./video-modal";

interface ExploreTabProps {
  mode: "video" | "image" | "music";
  onGenerateSimilar?: (data: { prompt: string; imageUrl?: string }) => void;
}

// 模拟的官方案例数据 - Nano Banana 生成的图片和 VEO3 生成的视频
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
  {
    id: "13",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Misty mountain range at dawn",
  },
  {
    id: "14",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    model: "VEO3",
    prompt: "Fantasy castle in the clouds",
  },
  {
    id: "15",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Vibrant city lights at night",
  },
  {
    id: "16",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    model: "VEO3",
    prompt: "Adventure road trip through nature",
  },
  {
    id: "17",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Ancient forest with sunlight rays",
  },
  {
    id: "18",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    model: "VEO3",
    prompt: "Sci-fi futuristic cityscape",
  },
  {
    id: "19",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Abstract watercolor painting",
  },
  {
    id: "20",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4",
    model: "VEO3",
    prompt: "Luxury car on scenic route",
  },
  {
    id: "21",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Peaceful countryside landscape",
  },
  {
    id: "22",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
    model: "VEO3",
    prompt: "Urban street life animation",
  },
  {
    id: "23",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Tropical paradise beach",
  },
  {
    id: "24",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ZoomForBeginners.mp4",
    model: "VEO3",
    prompt: "Dynamic motion and movement",
  },
  {
    id: "25",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&h=600&fit=crop",
    model: "Nano Banana",
    prompt: "Minimalist modern design",
  },
  {
    id: "26",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    model: "VEO3",
    prompt: "Nature documentary style",
  },
  {
    id: "27",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=1200&fit=crop",
    model: "Nano Banana",
    prompt: "Cosmic nebula and stars",
  },
  {
    id: "28",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    model: "VEO3",
    prompt: "Surreal dream sequence",
  },
  {
    id: "29",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&h=600&fit=crop",
    model: "Nano Banana",
    prompt: "Zen garden meditation",
  },
  {
    id: "30",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    model: "VEO3",
    prompt: "Epic cinematic landscape",
  },
  {
    id: "31",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&h=1000&fit=crop",
    model: "Nano Banana",
    prompt: "Cyberpunk neon cityscape",
  },
  {
    id: "32",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    model: "Sora2",
    prompt: "Magical fairy tale forest",
  },
  {
    id: "33",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
    model: "Nano Banana",
    prompt: "Vintage film photography style",
  },
  {
    id: "34",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    model: "Sora2",
    prompt: "Time-lapse of blooming flowers",
  },
  {
    id: "35",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Underwater coral reef",
  },
  {
    id: "36",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    model: "VEO3",
    prompt: "Aerial view of winding roads",
  },
  {
    id: "37",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&h=1200&fit=crop",
    model: "Nano Banana",
    prompt: "Steampunk mechanical design",
  },
  {
    id: "38",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    model: "Sora2",
    prompt: "Whimsical animated characters",
  },
  {
    id: "39",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=600&fit=crop",
    model: "Nano Banana",
    prompt: "Nordic aurora borealis",
  },
  {
    id: "40",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    model: "VEO3",
    prompt: "Dramatic storm clouds",
  },
  {
    id: "41",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Japanese cherry blossoms",
  },
  {
    id: "42",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    model: "Sora2",
    prompt: "Fantasy dragon flight",
  },
  {
    id: "43",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=1000&fit=crop",
    model: "Nano Banana",
    prompt: "Minimalist Scandinavian interior",
  },
  {
    id: "44",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    model: "VEO3",
    prompt: "Wildlife documentary style",
  },
  {
    id: "45",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&h=600&fit=crop",
    model: "Nano Banana",
    prompt: "Retro 80s synthwave aesthetic",
  },
  {
    id: "46",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    model: "Sora2",
    prompt: "Abstract fluid motion",
  },
  {
    id: "47",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Medieval castle architecture",
  },
  {
    id: "48",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    model: "VEO3",
    prompt: "Urban exploration adventure",
  },
  {
    id: "49",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=1200&fit=crop",
    model: "Nano Banana",
    prompt: "Bioluminescent deep sea",
  },
  {
    id: "50",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    model: "Sora2",
    prompt: "Cinematic slow-motion action",
  },
  {
    id: "51",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&h=600&fit=crop",
    model: "Nano Banana",
    prompt: "Art deco geometric patterns",
  },
  {
    id: "52",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    model: "VEO3",
    prompt: "Mountain peak sunrise",
  },
  {
    id: "53",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=1000&fit=crop",
    model: "Nano Banana",
    prompt: "Futuristic space station",
  },
  {
    id: "54",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    model: "Sora2",
    prompt: "Enchanted garden transformation",
  },
  {
    id: "55",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&h=800&fit=crop",
    model: "Nano Banana",
    prompt: "Impressionist painting style",
  },
  {
    id: "56",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    model: "VEO3",
    prompt: "Desert caravan journey",
  },
  {
    id: "57",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=600&fit=crop",
    model: "Nano Banana",
    prompt: "Neon-lit Tokyo streets",
  },
  {
    id: "58",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    model: "Sora2",
    prompt: "Mystical portal opening",
  },
  {
    id: "59",
    type: "image" as const,
    url: "https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5?w=800&h=1200&fit=crop",
    model: "Nano Banana",
    prompt: "Victorian era architecture",
  },
  {
    id: "60",
    type: "video" as const,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    model: "Sora2",
    prompt: "Epic battle scene",
  },
];

// 每批加载的数量
const ITEMS_PER_PAGE = 16;
// 初始加载数量（第一屏）
const INITIAL_LOAD = 12;

export function ExploreTab({ mode, onGenerateSimilar }: ExploreTabProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD);
  const [loadedVideos, setLoadedVideos] = useState<Set<string>>(new Set());
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const handleImageClick = (url: string) => {
    setSelectedImage(url);
  };

  const handleGenerateSimilar = (e: React.MouseEvent, example: typeof exploreExamples[0]) => {
    e.stopPropagation();
    if (onGenerateSimilar) {
      onGenerateSimilar({
        prompt: example.prompt,
        imageUrl: example.type === "image" ? example.url : undefined,
      });
    }
  };

  // 根据 mode 过滤内容（可选，或者显示所有内容）
  const filteredExamples = exploreExamples;
  const visibleExamples = filteredExamples.slice(0, visibleCount);

  // 无限滚动：使用 Intersection Observer 检测底部元素
  useEffect(() => {
    if (!loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredExamples.length) {
          setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredExamples.length));
        }
      },
      { rootMargin: "200px" } // 提前 200px 开始加载
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current && loadMoreRef.current) {
        observerRef.current.unobserve(loadMoreRef.current);
      }
    };
  }, [visibleCount, filteredExamples.length]);

  // 视频懒加载：只加载可见区域的视频
  const handleVideoIntersection = useCallback((id: string, containerElement: HTMLDivElement | null) => {
    if (!containerElement || loadedVideos.has(id)) return;

    const videoObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // 标记视频为已加载，触发重新渲染显示视频元素
          setLoadedVideos((prev) => {
            const newSet = new Set(prev);
            newSet.add(id);
            return newSet;
          });
          videoObserver.disconnect();
        }
      },
      { rootMargin: "200px" } // 提前 200px 加载视频
    );

    videoObserver.observe(containerElement);
  }, [loadedVideos]);

  // 视频点击时打开模态框（视频在模态框中加载）
  const handleVideoClick = useCallback((url: string) => {
    setSelectedVideo(url);
  }, []);

  // 生成视频封面 URL（使用视频的第一帧或占位图）
  const getVideoPoster = (videoUrl: string, prompt: string) => {
    // 使用更美观的占位图，实际项目中可以从视频提取第一帧
    // 这里使用渐变背景作为占位
    const hash = videoUrl.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      'from-blue-400/20 to-purple-400/20',
      'from-green-400/20 to-blue-400/20',
      'from-purple-400/20 to-pink-400/20',
      'from-orange-400/20 to-red-400/20',
    ];
    return colors[hash % colors.length];
  };

  return (
    <div className="px-6 pb-6">
      <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
        {visibleExamples.map((example) => (
          <div
            key={example.id}
            className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow mb-4 break-inside-avoid"
            onMouseEnter={() => setHoveredItem(example.id)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            {example.type === "image" ? (
              <div
                onClick={() => handleImageClick(example.url)}
                className="bg-gray-100 relative cursor-pointer"
              >
                <img
                  src={example.url}
                  alt={example.prompt}
                  className="w-full h-auto"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : (
              <div 
                className="bg-gray-100 relative cursor-pointer"
                onClick={() => handleVideoClick(example.url)}
              >
                {loadedVideos.has(example.id) ? (
                  <video
                    ref={(video) => {
                      if (video && !videoRefs.current[example.id]) {
                        videoRefs.current[example.id] = video;
                        // 设置视频属性
                        video.muted = true;
                        video.loop = true;
                        video.playsInline = true;
                        // 尝试自动播放
                        const tryPlay = async () => {
                          try {
                            await video.play();
                          } catch (error) {
                            // 如果自动播放失败，可能是浏览器策略限制
                            console.debug("Video autoplay prevented:", error);
                          }
                        };
                        // 如果视频已加载，直接播放；否则等待加载完成
                        if (video.readyState >= 2) {
                          tryPlay();
                        } else {
                          video.addEventListener('loadeddata', tryPlay, { once: true });
                          video.addEventListener('canplay', tryPlay, { once: true });
                        }
                      }
                    }}
                    src={example.url}
                    className="w-full h-auto"
                    muted
                    loop
                    playsInline
                    preload="auto"
                  />
                ) : (
                  <div 
                    ref={(div) => {
                      if (div) {
                        handleVideoIntersection(example.id, div);
                      }
                    }}
                    className={`relative w-full aspect-video bg-gradient-to-br ${getVideoPoster(example.url, example.prompt)}`}
                  >
                    {/* 视频封面占位 - 使用渐变背景 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-gray-400 text-xs opacity-50">{example.model}</div>
                    </div>
                    {/* 播放按钮指示 */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 group-hover:bg-black/10 transition-colors">
                      <div className="bg-white/90 rounded-full p-2 opacity-70 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4 text-gray-900 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Generate Similar Button */}
            {hoveredItem === example.id && onGenerateSimilar && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent px-2 pb-2 pt-6">
                <button
                  onClick={(e) => handleGenerateSimilar(e, example)}
                  className="w-full bg-white/80 text-gray-700 text-[10px] font-normal py-1.5 px-2 rounded border border-white/60 hover:bg-white/90 hover:text-gray-900 transition-colors"
                >
                  Generate Similar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 加载更多触发器 */}
      {visibleCount < filteredExamples.length && (
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
          <div className="text-gray-400 text-xs">Loading more...</div>
        </div>
      )}

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
