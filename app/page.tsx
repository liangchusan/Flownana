"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Features } from "@/components/sections/features";
import { Testimonials } from "@/components/sections/testimonials";
import { FAQ } from "@/components/sections/faq";
import { 
  ArrowRight, 
  Sparkles, 
  Video, 
  Image as ImageIcon, 
  Music, 
  Play,
  ChevronLeft,
  ChevronRight,
  Pause
} from "lucide-react";

// Hero 视频轮播内容 - 包含输入图片和prompt
const heroVideos = [
  {
    id: 1,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    inputImage: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
    prompt: "A peaceful forest scene with sunlight filtering through trees, cinematic quality, 4K",
    model: "VEO3.1",
    duration: "10s"
  },
  {
    id: 2,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    inputImage: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&h=600&fit=crop",
    prompt: "Urban cityscape at night with neon lights, futuristic atmosphere, cinematic",
    model: "VEO3.1",
    duration: "15s"
  },
  {
    id: 3,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    inputImage: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&h=600&fit=crop",
    prompt: "Ocean waves crashing on rocky shore, golden hour lighting, epic cinematic",
    model: "VEO3.1",
    duration: "12s"
  }
];

export default function Home() {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showHeaderBackground, setShowHeaderBackground] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // 滚动监听 - 控制导航栏背景显示
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setShowHeaderBackground(scrollY > 50); // 滚动超过50px时显示背景
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 视频自动轮播
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentVideoIndex((prev) => {
        const nextIndex = (prev + 1) % heroVideos.length;
        // 停止当前视频，播放下一个
        if (videoRefs.current[prev]) {
          videoRefs.current[prev]?.pause();
        }
        if (videoRefs.current[nextIndex]) {
          videoRefs.current[nextIndex]?.play();
        }
        return nextIndex;
      });
    }, 8000); // 每个视频播放8秒

    return () => clearInterval(interval);
  }, [isPlaying]);

  // 初始化第一个视频播放
  useEffect(() => {
    if (videoRefs.current[0]) {
      videoRefs.current[0]?.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, []);

  const currentVideo = heroVideos[currentVideoIndex];

  const handleVideoClick = () => {
    const video = videoRefs.current[currentVideoIndex];
    if (video) {
      if (video.paused) {
        video.play();
        setIsPlaying(true);
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }
  };

  const handlePrevVideo = () => {
    const prevIndex = (currentVideoIndex - 1 + heroVideos.length) % heroVideos.length;
    if (videoRefs.current[currentVideoIndex]) {
      videoRefs.current[currentVideoIndex]?.pause();
    }
    setCurrentVideoIndex(prevIndex);
    if (videoRefs.current[prevIndex]) {
      videoRefs.current[prevIndex]?.play();
      setIsPlaying(true);
    }
  };

  const handleNextVideo = () => {
    const nextIndex = (currentVideoIndex + 1) % heroVideos.length;
    if (videoRefs.current[currentVideoIndex]) {
      videoRefs.current[currentVideoIndex]?.pause();
    }
    setCurrentVideoIndex(nextIndex);
    if (videoRefs.current[nextIndex]) {
      videoRefs.current[nextIndex]?.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 导航栏 - 吸顶显示 */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Header showBackground={showHeaderBackground} />
      </div>

      {/* Hero Section - 全屏视频轮播，从顶部开始 */}
      <section className="relative h-screen w-full overflow-hidden bg-black">
        {/* 视频容器 */}
        <div className="absolute inset-0">
          {heroVideos.map((video, index) => (
            <video
              key={video.id}
              ref={(el) => {
                videoRefs.current[index] = el;
              }}
              src={video.videoUrl}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                index === currentVideoIndex ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
              muted
              loop
              playsInline
              preload="auto"
              onEnded={() => {
                if (index === currentVideoIndex) {
                  handleNextVideo();
                }
              }}
            />
          ))}
        </div>

        {/* 渐变遮罩 - 底部 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-20"></div>

        {/* 内容覆盖层 */}
        <div className="relative z-30 h-full flex flex-col">
          {/* 中间内容区域 - 居中显示 */}
          <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-20">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                Create Anything with AI
              </h1>
              <p className="text-xl md:text-2xl text-gray-200 mb-8 leading-relaxed max-w-2xl mx-auto">
                Transform your ideas into stunning videos, images, and music in seconds.
                <span className="text-white font-semibold"> No design skills required.</span>
              </p>

              <Link href="/ai-image">
                <Button size="lg" className="text-lg px-8 py-6 bg-white text-gray-900 hover:bg-gray-100 border-0 shadow-2xl">
                  Start Creating Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* 底部：输入图片和Prompt信息（小尺寸，参考KlingAI） */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30">
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20 max-w-2xl mx-auto">
              <div className="flex items-center gap-4">
                {/* 输入图片缩略图 */}
                <div className="relative w-20 h-12 rounded overflow-hidden flex-shrink-0 border border-white/20">
                  <img
                    src={currentVideo.inputImage}
                    alt="Input"
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Prompt文本 */}
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm leading-relaxed line-clamp-2">
                    {currentVideo.prompt}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/70">
                    <span>{currentVideo.model}</span>
                    <span>•</span>
                    <span>{currentVideo.duration}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 三大功能展示 */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Three Ways to Create
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Choose your creative path. From videos to images to music, we've got you covered.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* AI Video */}
            <Link href="/ai-video" className="group">
              <div className="relative h-[500px] rounded-3xl overflow-hidden bg-gradient-to-br from-blue-500 to-blue-700 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                <div className="absolute inset-0 flex flex-col justify-between p-8 text-white">
                  <div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Video className="h-8 w-8" />
                    </div>
                    <h3 className="text-3xl font-bold mb-3">AI Video</h3>
                    <p className="text-blue-100 mb-4 text-lg">
                      Create professional videos from text. Powered by VEO3.1
                    </p>
                  </div>
                  <div className="flex items-center text-white font-medium">
                    Try VEO3.1
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
                <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
                  <video
                    src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    onLoadedData={(e) => {
                      e.currentTarget.play().catch(() => {});
                    }}
                  />
                </div>
              </div>
            </Link>

            {/* AI Image */}
            <Link href="/ai-image" className="group">
              <div className="relative h-[500px] rounded-3xl overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                <div className="absolute inset-0 flex flex-col justify-between p-8 text-white">
                  <div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                    <h3 className="text-3xl font-bold mb-3">AI Image</h3>
                    <p className="text-purple-100 mb-4 text-lg">
                      Generate stunning visuals instantly. Powered by Nano Banana
                    </p>
                  </div>
                  <div className="flex items-center text-white font-medium">
                    Try Nano Banana
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
                <img
                  src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=800&fit=crop"
                  alt="AI Image"
                  className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity"
                />
              </div>
            </Link>

            {/* AI Music */}
            <Link href="/ai-music" className="group">
              <div className="relative h-[500px] rounded-3xl overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                <div className="absolute inset-0 flex flex-col justify-between p-8 text-white">
                  <div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Music className="h-8 w-8" />
                    </div>
                    <h3 className="text-3xl font-bold mb-3">AI Music</h3>
                    <p className="text-green-100 mb-4 text-lg">
                      Create original music and sounds. Powered by Suno
                    </p>
                  </div>
                  <div className="flex items-center text-white font-medium">
                    Try Suno
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  <div className="flex items-end gap-1 h-32">
                    {[...Array(20)].map((_, i) => (
                      <div
                        key={i}
                        className="w-2 bg-white rounded-full animate-pulse"
                        style={{
                          height: `${Math.random() * 60 + 20}%`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <Features />
      <Testimonials />
      <FAQ />

      {/* 最终 CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Create Something Amazing?
          </h2>
          <p className="text-xl text-blue-50 mb-8">
            Join 50,000+ creators using Flownana to bring their ideas to life. Start free today.
          </p>
          <div className="flex justify-center">
            <Link href="/ai-image">
              <Button size="lg" className="text-lg px-8 py-6 bg-white text-blue-600 hover:bg-gray-100 border-0 shadow-2xl">
                Start Creating Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
