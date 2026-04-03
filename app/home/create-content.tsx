"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreationSidebar } from "@/components/layout/creation-sidebar";
import {
  Video,
  Image as ImageIcon,
  Music,
  Sparkles,
  History,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";

type CreationType = "image" | "video" | "music";

interface Creation {
  id: string;
  type: CreationType;
  status: string;
  urls: string[];
  prompt: string;
  createdAt: string;
  taskId?: string;
}

// 模块1: 顶部大 Banner 卡片（支持图片或视频，横向滑动）
type BannerType = "image" | "video";

interface HeroBanner {
  id: string;
  type: BannerType;
  mediaUrl: string;
  title: string;
  description: string;
  tag: string;
}

const heroBanners: HeroBanner[] = [
  {
    id: "veo",
    type: "video",
    mediaUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    title: "Cinematic AI Video with VEO 3.1",
    description: "Turn storyboards and prompts into film‑style motion in seconds.",
    tag: "VEO 3.1",
  },
  {
    id: "nano-banana",
    type: "image",
    mediaUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop&q=80",
    title: "Photorealistic Images with Nano Banana",
    description: "Generate product shots, key visuals and thumbnails in 4K quality.",
    tag: "Nano Banana",
  },
  {
    id: "suno",
    type: "video",
    mediaUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    title: "Original Soundtracks with Suno",
    description: "Create music beds and hooks that sync with your visuals.",
    tag: "Suno",
  },
  {
    id: "workflow",
    type: "image",
    mediaUrl:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop&q=80",
    title: "Unified Workflow in Flownana",
    description: "Move between image, video and music creation in one simple workspace.",
    tag: "Workflow",
  },
];

// 模块2: 提示词案例（关键词形式，更简洁）
const promptExamples = [
  "Forest sunlight",
  "Neon city at night",
  "Golden hour ocean waves",
  "Abstract geometric shapes",
  "Fantasy castle in clouds",
  "Minimal modern building",
  "Tropical beach",
  "Starry mountain night",
  "Snowy winter forest",
  "Futuristic sci‑fi city",
];

export function CreateContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const [creationMode, setCreationMode] = useState<CreationType>("image");
  const [prompt, setPrompt] = useState("");
  const [recentCreations, setRecentCreations] = useState<Creation[]>([]);
  const bannerScrollRef = useRef<HTMLDivElement | null>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  // 模块1: Banner 精确滚动到指定卡片
  const scrollToBanner = (index: number) => {
    const container = bannerScrollRef.current;
    if (!container) return;
    const cards = container.querySelectorAll<HTMLDivElement>("[data-banner-card]");
    const clampedIndex = ((index % cards.length) + cards.length) % cards.length;
    const targetCard = cards[clampedIndex];
    if (!targetCard) return;

    // 在可滚动容器中，子元素的 offsetLeft 就是目标 scrollLeft
    const offsetLeft = targetCard.offsetLeft;
    container.scrollTo({
      left: offsetLeft,
      behavior: "smooth",
    });
  };

  const scrollBanners = (direction: "left" | "right") => {
    const delta = direction === "left" ? -1 : 1;
    setActiveBannerIndex((prev) => {
      const next = prev + delta;
      return ((next % heroBanners.length) + heroBanners.length) % heroBanners.length;
    });
  };

  // 当 activeBannerIndex 变化时，滚动到对应卡片
  useEffect(() => {
    if (!bannerScrollRef.current) return;
    scrollToBanner(activeBannerIndex);
  }, [activeBannerIndex]);

  // 模块3: 加载用户创作记录
  useEffect(() => {
    if (!session?.user?.email) {
      setRecentCreations([]);
      return;
    }
    try {
      const raw = localStorage.getItem(`creations_${session.user.email}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Creation[];
      setRecentCreations(parsed.slice(0, 8));
    } catch {
      setRecentCreations([]);
    }
  }, [session?.user?.email]);

  const handleStartCreating = () => {
    const trimmed = prompt.trim();
    const encoded = trimmed ? `?prompt=${encodeURIComponent(trimmed)}` : "";
    if (creationMode === "image") {
      router.push(`/ai-image${encoded}`);
      return;
    }
    if (creationMode === "video") {
      router.push(`/ai-video${encoded}`);
      return;
    }
    if (creationMode === "music") {
      router.push(`/ai-music${encoded}`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <CreationSidebar />
      <main className="flex-1 overflow-y-auto bg-white">
        {/* Top Bar */}
        <div className="sticky top-0 z-20 bg-white px-8 py-2 flex items-center justify-between border-b border-slate-200/60">
          <Link href="/" className="flex-shrink-0">
            <Logo size="md" />
          </Link>
          <div>
            {session ? (
              <UserMenu
                user={{
                  name: session.user?.name,
                  email: session.user?.email,
                  image: session.user?.image,
                }}
              />
            ) : (
              <Button
                onClick={() => signIn("google")}
                className="rounded-full border-0 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-1.5 text-sm text-white shadow-sm transition-all duration-200 hover:from-blue-700 hover:to-blue-800 hover:opacity-90 active:scale-[0.98]"
                size="sm"
              >
                Start Free Now
              </Button>
            )}
          </div>
        </div>

        <div className="ml-[70px] min-h-[calc(100vh-73px)]">
          {/* ---------- 模块1: 顶部大 Banner 卡片（图片/视频，横向滑动） ---------- */}
          <section className="border-b border-slate-100 banner-gradient-flow bg-gradient-to-r from-slate-50 via-blue-50/60 to-purple-50/60">
            <div className="w-full px-6 py-8 md:py-10">
              <div className="flex items-center justify-between mb-4 md:mb-6 gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <span className="font-medium">Featured capabilities</span>
                </div>
              </div>

                <div className="relative group">
                <div
                  ref={bannerScrollRef}
                  className="flex gap-4 md:gap-5 overflow-x-auto pb-2 scroll-smooth no-scrollbar"
                >
                  {heroBanners.map((banner) => (
                    <div
                      key={banner.id}
                      data-banner-card
                      className="shrink-0 w-[260px] sm:w-[320px] md:w-[380px] lg:w-[420px] flex flex-col gap-2"
                    >
                      {/* 媒体区域：图片 / 视频，16:9 比例 */}
                      <div className="relative w-full aspect-video overflow-hidden rounded-2xl bg-black">
                        {banner.type === "video" ? (
                          <video
                            src={banner.mediaUrl}
                            className="h-full w-full object-cover"
                            autoPlay
                            loop
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={banner.mediaUrl}
                            alt={banner.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                      </div>
                      {/* 文本区域：标题和描述放在图片下方（无白色背景，不与上半部分连在一起） */}
                      <div className="px-1 sm:px-1.5">
                        <h2 className="text-sm sm:text-base font-semibold leading-snug mb-1 text-slate-900">
                          {banner.title}
                        </h2>
                        <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-2">
                          {banner.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 左右滑动箭头：尽量对齐图片/视频区域中线，鼠标移入时显示 */}
                <div className="pointer-events-none absolute top-1 bottom-16 left-0 right-0 hidden md:flex items-center justify-between px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => scrollBanners("left")}
                    className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 bg-white/80 text-slate-500 hover:bg-white hover:border-slate-300 hover:text-slate-700 transition-colors backdrop-blur-sm"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollBanners("right")}
                    className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 bg-white/80 text-slate-500 hover:bg-white hover:border-slate-300 hover:text-slate-700 transition-colors backdrop-blur-sm"
                    aria-label="Next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ---------- 模块2: 引导创作入口 ---------- */}
          <section className="bg-gradient-to-b from-white via-slate-50/30 to-white py-10 px-6">
            <div className="max-w-2xl mx-auto">
              <h1 className="text-3xl md:text-4xl font-bold text-center mb-6 bg-gradient-to-r from-slate-800 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                What will you create today?
              </h1>

              {/* 创作类型 Pills */}
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {[
                  { id: "image" as const, label: "AI Image", icon: ImageIcon },
                  { id: "video" as const, label: "AI Video", icon: Video },
                  { id: "music" as const, label: "AI Music", icon: Music },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCreationMode(id)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                      creationMode === id
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                        : "bg-white text-slate-600 border-slate-200/60 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {/* 主输入框 */}
              <div className="relative rounded-2xl border border-slate-200/60 bg-white shadow-sm shadow-slate-200/50 focus-within:border-indigo-300 focus-within:shadow-md focus-within:shadow-indigo-100/50 transition-all">
                <div className="flex items-center px-4 py-3 gap-3">
                  <Search className="h-5 w-5 text-slate-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleStartCreating()}
                    placeholder="Enter your prompt to get started..."
                    className="flex-1 min-w-0 bg-transparent text-slate-900 placeholder:text-slate-400 outline-none text-base"
                  />
                </div>
                <div className="px-4 pb-3 pt-0 flex justify-end">
                  <Button
                    onClick={handleStartCreating}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-5 py-2 text-sm font-medium"
                  >
                    Start creating
                    <ChevronRight className="h-4 w-4 ml-1 inline" />
                  </Button>
                </div>
              </div>

              {/* 提示词案例 */}
              <p className="text-xs text-slate-500 mt-3 mb-2 text-left">Try a prompt example</p>
              <div className="flex flex-wrap justify-start gap-2">
                {promptExamples.slice(0, 6).map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="px-3 py-1.5 rounded-full text-xs text-slate-600 bg-white border border-slate-200/60 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 transition-colors line-clamp-1 max-w-[220px]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- 模块3: 用户创作记录 ---------- */}
          <section className="border-t border-slate-100 py-8 px-6 bg-slate-50/50">
            <div className="w-full">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <History className="h-5 w-5 text-slate-500" />
                Recent creations
              </h2>

              {session ? (
                recentCreations.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {recentCreations.map((c) => (
                      <Link
                        key={c.id}
                        href={
                          c.type === "image"
                            ? "/ai-image"
                            : c.type === "video"
                              ? "/ai-video"
                              : "/ai-music"
                        }
                        className="group rounded-xl border border-slate-200/60 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                      >
                        <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                          {c.urls?.[0] ? (
                            c.type === "video" ? (
                              <video
                                src={c.urls[0]}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={c.urls[0]}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            )
                          ) : (
                            <span className="text-slate-300">
                              {c.type === "image" && <ImageIcon className="h-10 w-10" />}
                              {c.type === "video" && <Video className="h-10 w-10" />}
                              {c.type === "music" && <Music className="h-10 w-10" />}
                            </span>
                          )}
                        </div>
                        <p className="p-2 text-xs text-slate-500 truncate border-t border-slate-100 group-hover:text-slate-700">
                          {c.prompt || "Untitled"}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200/60 bg-white/50 py-10 text-center">
                    <p className="text-slate-500 text-sm mb-2">No creations yet</p>
                    <p className="text-slate-400 text-xs mb-4">Start with a prompt above or open a studio.</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Link href="/ai-image">
                        <Button variant="outline" size="sm" className="rounded-full">
                          AI Image
                        </Button>
                      </Link>
                      <Link href="/ai-video">
                        <Button variant="outline" size="sm" className="rounded-full">
                          AI Video
                        </Button>
                      </Link>
                      <Link href="/ai-music">
                        <Button variant="outline" size="sm" className="rounded-full">
                          AI Music
                        </Button>
                      </Link>
                    </div>
                  </div>
                )
              ) : (
                <div className="rounded-xl border border-slate-200/60 bg-white py-8 px-6 text-center">
                  <p className="text-slate-600 text-sm mb-2">Sign in to see your creations</p>
                  <p className="text-slate-400 text-xs mb-4">
                    Your images, videos, and music will be saved here.
                  </p>
                  <Button
                    onClick={() => signIn("google")}
                    className="rounded-full border-0 bg-gradient-to-r from-blue-600 to-blue-700 px-5 text-white shadow-sm transition-all duration-200 hover:from-blue-700 hover:to-blue-800 hover:opacity-90 active:scale-[0.98]"
                  >
                    Sign in with Google
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
