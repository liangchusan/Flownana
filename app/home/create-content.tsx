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
  ChevronDown,
  Search,
  Loader2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getSignInLabel, signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import { mergeCreations, type CreationHistoryItem, type CreationStatus } from "@/lib/creation-history";

type CreationType = "image" | "video" | "music";

type Creation = CreationHistoryItem;

// 模块1: 顶部大 Banner 卡片（支持图片或视频，横向滑动）
type BannerType = "image" | "video";

interface HeroBanner {
  id: string;
  type: BannerType;
  mediaUrl: string;
  posterUrl?: string;
  title: string;
  description: string;
  tag: string;
}

const HOME_DEMO_VIDEO_URL = "/videos/flownana-home-demo.mp4";

const heroBanners: HeroBanner[] = [
  {
    id: "seedance-2-fast",
    type: "video",
    mediaUrl: HOME_DEMO_VIDEO_URL,
    posterUrl:
      "https://images.unsplash.com/photo-1517821099601-8ccf4a767a87?w=1200&auto=format&fit=crop&q=80",
    title: "Cinematic AI Video with Seedance 2 Fast",
    description: "Turn storyboards and prompts into film‑style motion in seconds.",
    tag: "Seedance 2 Fast",
  },
  {
    id: "gpt-image-2",
    type: "image",
    mediaUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop&q=80",
    title: "Photorealistic Images with GPT Image 2",
    description: "Generate product shots, key visuals and thumbnails in 4K quality.",
    tag: "GPT Image 2",
  },
  {
    id: "suno",
    type: "video",
    mediaUrl: HOME_DEMO_VIDEO_URL,
    posterUrl:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&auto=format&fit=crop&q=80",
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

const creationModeOptions = [
  { id: "image" as const, label: "AI Image", icon: ImageIcon },
  { id: "video" as const, label: "AI Video", icon: Video },
  { id: "music" as const, label: "AI Music", icon: Music },
];

const VALID_STATUS: CreationStatus[] = ["pending", "generating", "processing", "success", "failed"];
const LEGACY_STATUS_MAP: Record<string, CreationStatus> = {
  completed: "success",
  done: "success",
  error: "failed",
};

function isCreationStatus(value: unknown): value is CreationStatus {
  return typeof value === "string" && VALID_STATUS.includes(value as CreationStatus);
}

function isValidMediaUrl(url: unknown): url is string {
  return typeof url === "string" && url.trim().length > 0;
}

function normalizeCreation(raw: unknown): Creation | null {
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Partial<Creation> & {
    url?: unknown;
    imageUrl?: unknown;
    videoUrl?: unknown;
    audioUrl?: unknown;
    outputUrl?: unknown;
    resultUrl?: unknown;
  };
  const type = candidate.type;
  if (type !== "image" && type !== "video" && type !== "music") return null;
  if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) return null;

  const urlsFromArray = Array.isArray(candidate.urls)
    ? candidate.urls.filter(isValidMediaUrl)
    : [];
  const urlsFromLegacy = [
    candidate.url,
    candidate.imageUrl,
    candidate.videoUrl,
    candidate.audioUrl,
    candidate.outputUrl,
    candidate.resultUrl,
  ].filter(isValidMediaUrl);
  const urls = [...urlsFromArray, ...urlsFromLegacy].filter(
    (url, index, list) => list.indexOf(url) === index
  );
  const inputUrls = Array.isArray(candidate.inputUrls)
    ? candidate.inputUrls.filter(isValidMediaUrl)
    : [];

  const rawStatus = typeof candidate.status === "string" ? candidate.status.toLowerCase() : "";
  const mappedStatus = LEGACY_STATUS_MAP[rawStatus];
  const status = isCreationStatus(candidate.status) ? candidate.status : mappedStatus || "failed";

  return {
    id: candidate.id,
    type,
    status,
    urls,
    inputUrls,
    prompt: typeof candidate.prompt === "string" ? candidate.prompt : "",
    createdAt:
      typeof candidate.createdAt === "string" && candidate.createdAt.trim().length > 0
        ? candidate.createdAt
        : new Date().toISOString(),
    taskId: typeof candidate.taskId === "string" ? candidate.taskId : undefined,
    error: typeof candidate.error === "string" ? candidate.error : undefined,
  };
}

function getCreationStorageKeys(session: {
  user?: { id?: string | null; email?: string | null };
} | null): string[] {
  const keys = [
    session?.user?.id ? `creations_${session.user.id}` : null,
    session?.user?.email ? `creations_${session.user.email}` : null,
  ].filter((item): item is string => !!item);

  return Array.from(new Set(keys));
}

function formatCreationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function CreateContent({
  initialRecentCreations = [],
}: {
  initialRecentCreations?: Creation[];
}) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [creationMode, setCreationMode] = useState<CreationType>("image");
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [recentCreations, setRecentCreations] = useState<Creation[]>(initialRecentCreations);
  const [isLoadingCreations, setIsLoadingCreations] = useState(false);
  const bannerScrollRef = useRef<HTMLDivElement | null>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [videoFallbackMap, setVideoFallbackMap] = useState<Record<string, boolean>>({});
  const selectedMode = creationModeOptions.find((option) => option.id === creationMode) ?? creationModeOptions[0];
  const SelectedModeIcon = selectedMode.icon;

  // 模块1: Banner 精确滚动到指定卡片
  const scrollToBanner = (index: number) => {
    const container = bannerScrollRef.current;
    if (!container) return;
    const cards = container.querySelectorAll<HTMLDivElement>("[data-banner-card]");
    if (cards.length === 0) return;

    const clampedIndex = Math.min(Math.max(index, 0), cards.length - 1);
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
      return Math.min(Math.max(next, 0), heroBanners.length - 1);
    });
  };

  // 当 activeBannerIndex 变化时，滚动到对应卡片
  useEffect(() => {
    if (!bannerScrollRef.current) return;
    scrollToBanner(activeBannerIndex);
  }, [activeBannerIndex]);

  // 模块3: 加载用户创作记录
  useEffect(() => {
    if (sessionStatus === "loading") return;

    if (!session?.user?.id && !session?.user?.email) {
      setRecentCreations([]);
      setIsLoadingCreations(false);
      return;
    }

    const readLocalCreations = () => {
      const parsedAll: Creation[] = [];
      for (const key of getCreationStorageKeys(session)) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);
          const normalized = Array.isArray(parsed)
            ? parsed
                .map((item) => normalizeCreation(item))
                .filter((item): item is Creation => !!item)
            : [];
          parsedAll.push(...normalized);
        } catch (error) {
          console.error("Error parsing stored creations:", error);
        }
      }

      return mergeCreations(parsedAll, []);
    };

    let cancelled = false;
    const localCreations = readLocalCreations();
    const seededCreations = mergeCreations(initialRecentCreations, localCreations).slice(0, 8);
    setRecentCreations(seededCreations);
    setIsLoadingCreations(seededCreations.length === 0);

    fetch("/api/creations")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const fromApi = Array.isArray(data?.creations)
          ? data.creations
              .map((item: unknown) => normalizeCreation(item))
              .filter((item: Creation | null): item is Creation => !!item)
          : [];
        setRecentCreations(mergeCreations(fromApi, seededCreations).slice(0, 8));
      })
      .catch((error) => {
        console.error("Error fetching recent creations:", error);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCreations(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, sessionStatus, initialRecentCreations]);

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
    <div className="h-screen overflow-hidden">
      <CreationSidebar />
      <main className="ml-[60px] h-screen overflow-y-auto bg-[#FDFDF9]">
        <div className="min-h-screen bg-[linear-gradient(180deg,#FDFDF9_0%,#FAFAF6_48%,#FDFDF9_100%)]">
          {/* ---------- 模块1: 顶部大 Banner 卡片（图片/视频，横向滑动） ---------- */}
          <section className="border-b border-stone-100/70">
            <div className="mx-auto w-full max-w-[1680px] px-4 py-5 md:px-8 md:py-6 xl:px-10">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <Sparkles className="h-4 w-4 text-stone-500" />
                  <span className="font-medium">Featured capabilities</span>
                </div>
              </div>

              <div className="group relative">
                <div
                  ref={bannerScrollRef}
                  className="flex gap-4 overflow-x-auto pb-1 scroll-smooth no-scrollbar xl:grid xl:grid-cols-4 xl:overflow-visible"
                >
                  {heroBanners.map((banner) => (
                    <div
                      key={banner.id}
                      data-banner-card
                      className="group flex w-[76vw] max-w-sm shrink-0 flex-col overflow-hidden rounded-2xl border border-stone-200/50 bg-white shadow-sm transition-all duration-300 hover:border-stone-300 hover:shadow-md sm:w-[42vw] lg:w-[360px] xl:w-full xl:max-w-none"
                    >
                      {/* 媒体区域：图片 / 视频，16:9 比例 */}
                      <div className="relative aspect-video w-full overflow-hidden bg-black">
                        {banner.type === "video" && !videoFallbackMap[banner.id] ? (
                          <video
                            src={banner.mediaUrl}
                            className="h-full w-full object-cover transition-all duration-300 group-hover:scale-105"
                            autoPlay
                            loop
                            muted
                            playsInline
                            preload="metadata"
                            poster={banner.posterUrl}
                            onError={() =>
                              setVideoFallbackMap((prev) => ({ ...prev, [banner.id]: true }))
                            }
                          />
                        ) : (
                          <img
                            src={banner.posterUrl ?? banner.mediaUrl}
                            alt={banner.title}
                            className="h-full w-full object-cover transition-all duration-300 group-hover:scale-105"
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                        <div className="absolute left-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-[11px] font-medium text-stone-700 shadow-sm">
                          {banner.tag}
                        </div>
                      </div>
                      {/* 文本区域：标题和描述放在图片下方（无白色背景，不与上半部分连在一起） */}
                      <div className="px-3 pb-3 pt-2.5">
                        <h2 className="mb-0.5 truncate text-sm font-semibold leading-snug text-stone-900">
                          {banner.title}
                        </h2>
                        <p className="truncate text-[11px] text-stone-500 sm:text-xs">
                          {banner.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-2 opacity-0 transition-all duration-300 group-hover:opacity-100 md:flex xl:hidden">
                  <button
                    type="button"
                    onClick={() => scrollBanners("left")}
                    disabled={activeBannerIndex === 0}
                    className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200/70 bg-white/90 text-stone-500 shadow-md shadow-stone-200/30 backdrop-blur-sm transition-all duration-300 hover:border-stone-300 hover:bg-white hover:text-stone-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-stone-200/70 disabled:hover:text-stone-500 disabled:active:scale-100"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollBanners("right")}
                    disabled={activeBannerIndex === heroBanners.length - 1}
                    className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200/70 bg-white/90 text-stone-500 shadow-md shadow-stone-200/30 backdrop-blur-sm transition-all duration-300 hover:border-stone-300 hover:bg-white hover:text-stone-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-stone-200/70 disabled:hover:text-stone-500 disabled:active:scale-100"
                    aria-label="Next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ---------- 模块2: 引导创作入口 ---------- */}
          <section className="px-4 py-10 md:px-8 md:py-12">
            <div className="mx-auto w-full max-w-[1280px]">
              <h1 className="mx-auto mb-6 max-w-5xl text-center text-3xl font-bold leading-tight text-stone-900 md:text-5xl">
                What will you create today?
              </h1>

              {/* 主输入框 */}
              <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-lg shadow-stone-200/20 transition-all duration-300 focus-within:border-stone-300">
                <div className="flex min-h-36 items-start gap-3 px-4 py-4 md:min-h-40 md:px-6 md:py-5">
                  <Search className="mt-1.5 h-5 w-5 flex-shrink-0 text-stone-400" />
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleStartCreating();
                      }
                    }}
                    placeholder="Enter your prompt to get started..."
                    rows={4}
                    className="min-h-28 min-w-0 flex-1 resize-none bg-transparent text-base leading-relaxed text-stone-900 outline-none placeholder:text-stone-400 md:min-h-32 md:text-lg"
                  />
                </div>
                <div className="relative border-t border-stone-100 px-4 py-3 md:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsModeMenuOpen((open) => !open)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-200/70 bg-stone-50 px-3 text-sm font-medium text-stone-700 transition-all duration-300 hover:border-stone-300 hover:bg-white active:scale-[0.98]"
                        aria-expanded={isModeMenuOpen}
                        aria-haspopup="listbox"
                      >
                        <SelectedModeIcon className="h-4 w-4 text-stone-500" />
                        <span>{selectedMode.label}</span>
                        <ChevronDown className={`h-4 w-4 text-stone-400 transition-all duration-300 ${isModeMenuOpen ? "rotate-180" : ""}`} />
                      </button>

                      {isModeMenuOpen && (
                        <div
                          role="listbox"
                          className="absolute bottom-12 left-0 z-10 w-44 overflow-hidden rounded-xl border border-stone-200/70 bg-white p-1 shadow-lg shadow-stone-200/30"
                        >
                          {creationModeOptions.map(({ id, label, icon: Icon }) => (
                            <button
                              key={id}
                              type="button"
                              role="option"
                              aria-selected={creationMode === id}
                              onClick={() => {
                                setCreationMode(id);
                                setIsModeMenuOpen(false);
                              }}
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all duration-300 ${
                                creationMode === id
                                  ? "bg-stone-900 text-white"
                                  : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={handleStartCreating}
                      className="ml-auto rounded-xl bg-stone-800 px-5 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-stone-800/90 active:scale-[0.98]"
                    >
                      Start creating
                      <ChevronRight className="h-4 w-4 ml-1 inline" />
                    </Button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                    {promptExamples.slice(0, 6).map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => setPrompt(example)}
                        className="line-clamp-1 max-w-xs rounded-xl border border-stone-200/50 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600 transition-all duration-300 hover:border-stone-300 hover:bg-white hover:text-stone-900 active:scale-[0.98]"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------- 模块3: 用户创作记录 ---------- */}
          <section className="px-4 pb-10 md:px-8">
            <div className="mx-auto w-full max-w-[1680px] rounded-2xl border border-stone-200/60 bg-white/70 p-4 shadow-sm md:p-6 xl:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
                  <History className="h-5 w-5 text-stone-500" />
                  Recent creations
                </h2>
                {session && recentCreations.length > 0 && (
                  <Link
                    href="/ai-image"
                    className="text-sm font-medium text-stone-500 transition-all duration-300 hover:text-stone-900"
                  >
                    Open studio
                  </Link>
                )}
              </div>

              {session ? (
                isLoadingCreations && recentCreations.length === 0 ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        className="overflow-hidden rounded-xl border border-stone-200/50 bg-white shadow-sm"
                      >
                        <div className="aspect-[4/3] animate-pulse bg-stone-100" />
                        <div className="space-y-2 p-3">
                          <div className="h-3 w-3/4 animate-pulse rounded bg-stone-100" />
                          <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentCreations.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
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
                        className="group overflow-hidden rounded-xl border border-stone-200/50 bg-white shadow-sm transition-all duration-300 hover:border-stone-300 hover:shadow-md"
                      >
                        <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-stone-100">
                          {c.status === "pending" || c.status === "generating" || c.status === "processing" ? (
                            <div className="flex h-full w-full flex-col items-center justify-center bg-stone-50">
                              <Loader2 className="mb-2 h-6 w-6 animate-spin text-stone-500" />
                              <span className="text-xs font-medium text-stone-500">
                                {c.status === "pending" ? "Queued" : c.status === "processing" ? "Processing" : "Generating"}
                              </span>
                            </div>
                          ) : c.urls?.[0] ? (
                            c.type === "video" ? (
                              <video
                                src={c.urls[0]}
                                className="h-full w-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={c.urls[0]}
                                alt=""
                                className="h-full w-full object-cover transition-all duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                            )
                          ) : (
                            <span className="flex flex-col items-center gap-2 text-stone-300">
                              {c.type === "image" && <ImageIcon className="h-9 w-9" />}
                              {c.type === "video" && <Video className="h-9 w-9" />}
                              {c.type === "music" && <Music className="h-9 w-9" />}
                              <span className="text-xs text-stone-400">
                                {c.status === "failed" ? "Failed" : "No media"}
                              </span>
                            </span>
                          )}
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[11px] font-medium capitalize text-stone-700 shadow-sm">
                            {c.type === "image" && <ImageIcon className="h-3 w-3" />}
                            {c.type === "video" && <Video className="h-3 w-3" />}
                            {c.type === "music" && <Music className="h-3 w-3" />}
                            {c.type}
                          </span>
                        </div>
                        <div className="border-t border-stone-100 p-3">
                          <p className="truncate text-xs font-medium text-stone-700 group-hover:text-stone-900">
                            {c.prompt || "Untitled"}
                          </p>
                          <p className="mt-1 flex items-center justify-between gap-2 text-[11px] text-stone-400">
                            <span className="capitalize">{c.status}</span>
                            <span>{formatCreationDate(c.createdAt)}</span>
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-200/50 bg-white/60 py-10 text-center">
                    <p className="mb-2 text-sm text-stone-500">No creations yet</p>
                    <p className="mb-4 text-xs text-stone-400">Start with a prompt above or open a studio.</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Link href="/ai-image">
                        <Button variant="outline" size="sm" className="rounded-xl">
                          AI Image
                        </Button>
                      </Link>
                      <Link href="/ai-video">
                        <Button variant="outline" size="sm" className="rounded-xl">
                          AI Video
                        </Button>
                      </Link>
                      <Link href="/ai-music">
                        <Button variant="outline" size="sm" className="rounded-xl">
                          AI Music
                        </Button>
                      </Link>
                    </div>
                  </div>
                )
              ) : (
                <div className="rounded-xl border border-stone-200/50 bg-white px-6 py-8 text-center">
                  <p className="mb-2 text-sm text-stone-600">Sign in to see your creations</p>
                  <p className="mb-4 text-xs text-stone-400">
                    Your images, videos, and music will be saved here.
                  </p>
                  <Button
                    onClick={() => signInForCurrentEnvironment()}
                    className="rounded-xl border-0 bg-stone-800 px-5 text-white shadow-sm transition-all duration-300 hover:bg-stone-800/90 active:scale-[0.98]"
                  >
                    {getSignInLabel()}
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
