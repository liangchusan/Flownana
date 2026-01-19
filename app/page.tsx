"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Features } from "@/components/sections/features";
import { Testimonials } from "@/components/sections/testimonials";
import { Pricing } from "@/components/sections/pricing";
import { FAQ } from "@/components/sections/faq";
import { 
  ArrowRight, 
  Sparkles, 
  Video, 
  Image as ImageIcon, 
  Music, 
  Zap, 
  Play,
  TrendingUp,
  Users,
  Clock,
  CheckCircle2
} from "lucide-react";

// Hero 轮播内容
const heroContent = [
  {
    type: "video",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    prompt: "A peaceful forest scene with sunlight filtering through trees",
    model: "VEO3.1"
  },
  {
    type: "image",
    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop",
    prompt: "A beautiful sunset over mountains",
    model: "Nano Banana"
  },
  {
    type: "image",
    url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1200&h=800&fit=crop",
    prompt: "Abstract geometric patterns in vibrant colors",
    model: "Nano Banana"
  }
];

export default function Home() {
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Hero 内容自动轮播
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % heroContent.length);
      setIsVideoPlaying(false);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentHero = heroContent[currentHeroIndex];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section - 全屏震撼效果 */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900">
        {/* 动态背景粒子效果 */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* 左侧：文字内容 */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-medium mb-6 border border-white/20">
                <Sparkles className="h-4 w-4 mr-2" />
                Powered by VEO3.1, Nano Banana & Suno
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                Create Anything
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  with AI
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-200 mb-8 leading-relaxed">
                Transform your ideas into stunning videos, images, and music in seconds. 
                <span className="text-white font-semibold"> No design skills required.</span>
              </p>

              {/* 统计数据 */}
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div>
                  <div className="text-3xl font-bold text-white mb-1">15-30s</div>
                  <div className="text-sm text-gray-300">Generation Time</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-white mb-1">100K+</div>
                  <div className="text-sm text-gray-300">Creations</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-white mb-1">4.9/5</div>
                  <div className="text-sm text-gray-300">User Rating</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/ai-image">
                  <Button size="lg" className="text-lg px-8 py-6 bg-white text-blue-900 hover:bg-gray-100 border-0 shadow-2xl">
                    Start Creating Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/home">
                  <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-2 border-white/30 text-white hover:bg-white/10 backdrop-blur-sm">
                    Explore Gallery
                  </Button>
                </Link>
              </div>
            </div>

            {/* 右侧：动态内容展示 */}
            <div className="relative">
              <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black/50 backdrop-blur-sm border border-white/20">
                {currentHero.type === "video" ? (
                  <div className="relative w-full h-full">
                    <video
                      key={currentHeroIndex}
                      src={currentHero.url}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      autoPlay
                      onPlay={() => setIsVideoPlaying(true)}
                      onLoadedData={(e) => {
                        const video = e.currentTarget;
                        video.play().catch(() => {
                          setIsVideoPlaying(false);
                        });
                      }}
                    />
                    {!isVideoPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const video = e.currentTarget.parentElement?.querySelector('video');
                            if (video) {
                              video.play().then(() => {
                                setIsVideoPlaying(true);
                              }).catch(() => {
                                // Autoplay prevented
                              });
                            }
                          }}
                          className="bg-white/90 hover:bg-white rounded-full p-4 transition-all"
                        >
                          <Play className="h-8 w-8 text-blue-900 ml-1" fill="currentColor" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <img
                    src={currentHero.url}
                    alt={currentHero.prompt}
                    className="w-full h-full object-cover"
                  />
                )}
                
                {/* 内容信息覆盖层 */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-6">
                  <div className="text-xs text-blue-300 mb-2 font-medium">{currentHero.model}</div>
                  <div className="text-white text-sm line-clamp-2">{currentHero.prompt}</div>
                </div>

                {/* 轮播指示器 */}
                <div className="absolute top-4 right-4 flex gap-2">
                  {heroContent.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentHeroIndex(index);
                        setIsVideoPlaying(false);
                      }}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentHeroIndex ? 'bg-white w-6' : 'bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 滚动指示 */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-3 bg-white/50 rounded-full"></div>
          </div>
        </div>
      </section>

      {/* 三大功能展示 - 视觉化卡片 */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50">
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
                {/* 背景视频预览 */}
                <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
                  <video
                    src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    onLoadedData={(e) => {
                      e.currentTarget.play().catch(() => {
                        // Autoplay prevented, ignore
                      });
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
                {/* 背景图片预览 */}
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
                {/* 音频波形动画背景 */}
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

      {/* 核心优势展示 */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Why Creators Choose Flownana
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              The fastest, most accurate AI content generation platform
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-xl transition-all">
              <div className="bg-blue-500 rounded-full p-4 w-16 h-16 flex items-center justify-center mx-auto mb-6">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Lightning Fast</h3>
              <p className="text-gray-600 mb-4">
                Generate content in 15-30 seconds. No more waiting hours for results.
              </p>
              <div className="text-3xl font-bold text-blue-600">15-30s</div>
            </div>

            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-xl transition-all">
              <div className="bg-purple-500 rounded-full p-4 w-16 h-16 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Perfect First Try</h3>
              <p className="text-gray-600 mb-4">
                Get perfect results on your first attempt. No endless iterations needed.
              </p>
              <div className="text-3xl font-bold text-purple-600">95%+</div>
            </div>

            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-green-50 to-green-100 hover:shadow-xl transition-all">
              <div className="bg-green-500 rounded-full p-4 w-16 h-16 flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Trusted by Many</h3>
              <p className="text-gray-600 mb-4">
                Join 50,000+ creators who trust Flownana for their content needs.
              </p>
              <div className="text-3xl font-bold text-green-600">50K+</div>
            </div>
          </div>
        </div>
      </section>

      {/* 实际案例展示 - 瀑布流预览 */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              See What's Possible
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Real creations from real users. Get inspired and start creating.
            </p>
          </div>

          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 mb-8">
            {[
              { type: "image", url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=800&fit=crop", prompt: "Mountain sunset" },
              { type: "image", url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600&h=400&fit=crop", prompt: "Abstract art" },
              { type: "video", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", prompt: "Forest scene" },
              { type: "image", url: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=600&h=600&fit=crop", prompt: "Lake reflection" },
              { type: "image", url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&h=800&fit=crop", prompt: "Starry night" },
              { type: "video", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", prompt: "City lights" },
              { type: "image", url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop", prompt: "Desert landscape" },
              { type: "image", url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600&h=600&fit=crop", prompt: "Modern architecture" },
            ].map((item, index) => (
              <div
                key={index}
                className="group relative mb-4 break-inside-avoid rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer"
              >
                {item.type === "video" ? (
                  <video
                    src={item.url}
                    className="w-full h-auto"
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    onLoadedData={(e) => {
                      e.currentTarget.play().catch(() => {
                        // Autoplay prevented, ignore
                      });
                    }}
                  />
                ) : (
                  <img
                    src={item.url}
                    alt={item.prompt}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <p className="text-sm line-clamp-2">{item.prompt}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/home">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-2">
                Explore More Creations
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Features />
      <Testimonials />
      <Pricing />
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
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/ai-image">
              <Button size="lg" className="text-lg px-8 py-6 bg-white text-blue-600 hover:bg-gray-100 border-0 shadow-2xl">
                Start Creating Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-2 border-white/30 text-white hover:bg-white/10 backdrop-blur-sm">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
