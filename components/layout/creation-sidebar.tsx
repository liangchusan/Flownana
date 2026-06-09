"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Video, Image as ImageIcon, Music, Home } from "lucide-react";
import { useSession } from "next-auth/react";
import { Logo } from "@/components/ui/logo";
import { CreditsWidget } from "@/components/creation/credits-widget";
import { UserMenu } from "@/components/layout/user-menu";

function SidebarContent() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  
  // Extract mode from pathname
  const currentMode = pathname === "/ai-video" ? "video" 
    : pathname === "/ai-image" ? "image"
    : pathname === "/ai-music" ? "voice"
    : null;

  const navItems = [
    { id: "image", label: "AI Image", icon: ImageIcon, href: "/ai-image" },
    { id: "video", label: "AI Video", icon: Video, href: "/ai-video" },
    { id: "voice", label: "AI Music", icon: Music, href: "/ai-music" },
  ];

  // Check if we're on the home page
  const isHome = pathname === "/home";

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[60px] flex-col overflow-x-hidden border-r border-stone-200/50 bg-[#F7F4ED]">
      <div className="flex h-16 items-center justify-center">
        <Link
          href="/home"
          className="flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 hover:bg-white/70"
          aria-label="Flownana home"
        >
          <Logo size="md" showText={false} />
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 pb-4 pt-4">
        {/* Navigation */}
        <nav className="space-y-2">
          <Link
            href="/home"
            className="group mx-auto flex w-full flex-col items-center justify-center gap-1 rounded-xl py-1 text-stone-700 transition-all duration-300 hover:text-stone-900"
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 ${
                isHome
                  ? "bg-white/80 text-stone-900 shadow-sm shadow-stone-200/40"
                  : "group-hover:bg-white/60"
              }`}
            >
              <Home className="h-5 w-5" />
            </span>
            <span className="w-full text-center text-[10px] font-medium leading-tight">Home</span>
          </Link>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentMode === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="group mx-auto flex w-full flex-col items-center justify-center gap-1 rounded-xl py-1 text-stone-700 transition-all duration-300 hover:text-stone-900"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 ${
                    isActive
                      ? "bg-white/80 text-stone-900 shadow-sm shadow-stone-200/40"
                      : "group-hover:bg-white/60"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="w-full text-center text-[10px] font-medium leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-2">
        {status === "loading" ? (
          <div className="space-y-2 rounded-2xl border border-stone-200/50 bg-white p-1.5">
            <div className="h-10 w-full animate-pulse rounded-xl bg-stone-100" />
            <div className="mx-auto h-8 w-8 animate-pulse rounded-full bg-stone-100" />
          </div>
        ) : session ? (
          <div className="flex flex-col items-center gap-2">
            <CreditsWidget variant="sidebar" />
            <UserMenu
              align="left"
              compact
              user={{
                name: session.user?.name,
                email: session.user?.email,
                image: session.user?.image,
              }}
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function CreationSidebar() {
  return (
    <Suspense fallback={
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-[60px] flex-col overflow-x-hidden border-r border-stone-200/50 bg-[#F7F4ED]">
        <div className="flex h-16 items-center justify-center">
          <div className="h-10 w-10 rounded-xl bg-stone-100" />
        </div>
        <div className="min-h-0 flex-1 px-1 pb-4 pt-4">
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="mx-auto h-14 w-10 rounded-xl bg-stone-100"></div>
            ))}
          </div>
        </div>
      </aside>
    }>
      <SidebarContent />
    </Suspense>
  );
}
