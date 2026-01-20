"use client";

import { useEffect, useState } from "react";
import { CreationSidebar } from "@/components/layout/creation-sidebar";
import {
  Video,
  Image as ImageIcon,
  Music,
  ArrowRight,
  Play,
  Sparkles,
  Clock,
  Activity,
  History,
} from "lucide-react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";

type CreationType = "video" | "image" | "music";

interface Creation {
  id: string;
  type: CreationType;
  createdAt: string;
}

export function CreateContent() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<{
    total: number;
    video: number;
    image: number;
    music: number;
    latestMode?: CreationType;
  }>({
    total: 0,
    video: 0,
    image: 0,
    music: 0,
    latestMode: undefined,
  });

  useEffect(() => {
    if (!session?.user?.email) return;

    try {
      const raw = localStorage.getItem(`creations_${session.user.email}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Creation[];

      const total = parsed.length;
      let video = 0;
      let image = 0;
      let music = 0;

      parsed.forEach((c) => {
        if (c.type === "video") video += 1;
        if (c.type === "image") image += 1;
        if (c.type === "music") music += 1;
      });

      const latest = parsed[0];

      setStats({
        total,
        video,
        image,
        music,
        latestMode: latest?.type,
      });
    } catch (error) {
      console.error("Failed to load creation stats", error);
    }
  }, [session?.user?.email]);

  const welcomeTitle = session?.user?.name
    ? `Welcome back, ${session.user.name.split(" ")[0]}`
    : "Create Anything with AI";

  return (
    <div className="flex h-screen overflow-hidden">
      <CreationSidebar />
      <main className="flex-1 overflow-y-auto bg-white">
        {/* Top Bar with Logo and User Info - Full width, above sidebar */}
        <div className="sticky top-0 z-20 bg-white px-8 py-2 flex items-center justify-between border-b border-gray-100">
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
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 text-sm px-4 py-1.5"
                size="sm"
              >
                Start Free Now
              </Button>
            )}
          </div>
        </div>

        {/* Home Navigation / Dashboard - starts below top bar with left margin for sidebar */}
        <div className="ml-[70px] min-h-[calc(100vh-73px)] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div className="max-w-7xl mx-auto px-10 py-10 text-white">
            {/* Hero + Stats */}
            <div className="flex flex-col lg:flex-row items-start justify-between gap-8 mb-10">
              <div>
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-xs font-medium mb-4 border border-white/15">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Powered by VEO3.1, Nano Banana & Suno
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-3">{welcomeTitle}</h1>
                <p className="text-base md:text-lg text-slate-200 max-w-xl">
                  Jump back into your creative flow. Generate videos, images, and music in seconds
                  with simple text prompts.
                </p>
                {session && stats.total > 0 && (
                  <div className="mt-4 inline-flex items-center text-xs text-slate-300 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                    <History className="h-3 w-3 mr-1.5" />
                    Last time you created{" "}
                    <span className="font-medium mx-1">
                      {stats.latestMode === "video"
                        ? "an AI Video"
                        : stats.latestMode === "image"
                        ? "an AI Image"
                        : "AI Music"}
                    </span>
                    — pick up right where you left off.
                  </div>
                )}
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-3 gap-4 w-full lg:w-auto lg:min-w-[320px]">
                <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-300 uppercase tracking-wide">
                      Total Creations
                    </span>
                    <Clock className="h-4 w-4 text-slate-300" />
                  </div>
                  <div className="text-2xl font-bold">
                    {stats.total > 0 ? stats.total : session ? 0 : "--"}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-300 uppercase tracking-wide">
                      This Week
                    </span>
                    <Activity className="h-4 w-4 text-slate-300" />
                  </div>
                  <div className="text-2xl font-bold">15-30s</div>
                  <p className="text-[10px] text-slate-300 mt-1">
                    Typical generation time per creation.
                  </p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-100 uppercase tracking-wide">
                      Fast Start
                    </span>
                    <Play className="h-4 w-4 text-slate-100" />
                  </div>
                  <p className="text-[11px] text-slate-50">
                    Choose a mode below and start creating instantly.
                  </p>
                </div>
              </div>
            </div>

            {/* Mode cards row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {/* AI Image Card */}
              <Link href="/ai-image" className="group">
                <div className="bg-white rounded-2xl shadow-[0_18px_60px_rgba(15,23,42,0.75)] hover:shadow-[0_26px_80px_rgba(15,23,42,0.9)] transition-all duration-300 p-6 border border-slate-800 hover:border-purple-400 hover:-translate-y-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg p-3">
                      <ImageIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">AI Image</h2>
                      <p className="text-xs text-slate-500">
                        Powered by Nano Banana for photorealistic images.
                      </p>
                    </div>
                  </div>
                  <div className="aspect-square bg-gradient-to-br from-purple-50 via-indigo-50 to-pink-50 rounded-xl overflow-hidden mb-4 border border-purple-100">
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-purple-500" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center font-medium text-purple-600 group-hover:gap-2 transition-all">
                      <span>Open Image Studio</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {stats.image > 0 ? `${stats.image} created` : "Best for thumbnails & ads"}
                    </span>
                  </div>
                </div>
              </Link>

              {/* AI Video Card */}
              <Link href="/ai-video" className="group">
                <div className="bg-white rounded-2xl shadow-[0_18px_60px_rgba(15,23,42,0.75)] hover:shadow-[0_26px_80px_rgba(15,23,42,0.9)] transition-all duration-300 p-6 border border-slate-800 hover:border-blue-400 hover:-translate-y-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg p-3">
                      <Video className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">AI Video</h2>
                      <p className="text-xs text-slate-500">
                        Powered by VEO 3.1 for cinematic video generation.
                      </p>
                    </div>
                  </div>
                  <div className="aspect-video bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50 rounded-xl overflow-hidden mb-4 border border-blue-100">
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="h-12 w-12 text-blue-500" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center font-medium text-blue-600 group-hover:gap-2 transition-all">
                      <span>Open Video Studio</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {stats.video > 0 ? `${stats.video} created` : "Best for social & ads"}
                    </span>
                  </div>
                </div>
              </Link>

              {/* AI Music Card */}
              <Link href="/ai-music" className="group">
                <div className="bg-white rounded-2xl shadow-[0_18px_60px_rgba(15,23,42,0.75)] hover:shadow-[0_26px_80px_rgba(15,23,42,0.9)] transition-all duration-300 p-6 border border-slate-800 hover:border-green-400 hover:-translate-y-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg p-3">
                      <Music className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">AI Music</h2>
                      <p className="text-xs text-slate-500">
                        Powered by Suno for AI-composed tracks and soundscapes.
                      </p>
                    </div>
                  </div>
                  <div className="aspect-video bg-gradient-to-br from-emerald-50 via-green-50 to-lime-50 rounded-xl overflow-hidden mb-4 border border-green-100">
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="h-12 w-12 text-green-500" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center font-medium text-green-600 group-hover:gap-2 transition-all">
                      <span>Open Music Studio</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {stats.music > 0 ? `${stats.music} created` : "Best for intros & reels"}
                    </span>
                  </div>
                </div>
              </Link>
            </div>

            {/* Quick links for logged-in users */}
            {session ? (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/5 border border-white/10">
                  <History className="h-3.5 w-3.5 mr-1.5" />
                  View{" "}
                  <Link
                    href="/ai-image"
                    className="underline decoration-dotted underline-offset-2 mx-1"
                  >
                    My Creations
                  </Link>
                  in any studio.
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/5 border border-white/10">
                  <Activity className="h-3.5 w-3.5 mr-1.5" />
                  Tip: use{" "}
                  <span className="font-semibold mx-1">natural English</span> to describe edits,
                  Flownana handles the rest.
                </span>
              </div>
            ) : (
              <div className="mt-4 text-xs text-slate-300">
                Sign in to save your creations across devices and unlock personalized suggestions.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
