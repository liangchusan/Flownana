"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Video, Image as ImageIcon, Music, Home } from "lucide-react";

function SidebarContent() {
  const pathname = usePathname();
  
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
    <aside className="fixed left-0 top-12 h-[calc(100vh-3rem)] w-16 overflow-y-auto bg-[#FDFDF9]">
      <div className="pb-4 pt-4">
        {/* Navigation */}
        <nav className="space-y-4 px-2">
          <Link
            href="/home"
            className={`group flex flex-col items-center gap-1 rounded-xl py-2 transition-all duration-300 ${
              isHome
                ? "bg-stone-100 text-stone-700"
                : "text-stone-700 hover:bg-stone-50 hover:text-stone-900"
            }`}
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentMode === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`group flex flex-col items-center gap-1 rounded-xl py-2 transition-all duration-300 ${
                  isActive
                    ? "bg-stone-100 text-stone-700"
                    : "text-stone-700 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      {/* Border line on the right */}
      <div className="absolute bottom-0 right-0 top-0 w-px bg-stone-200/50"></div>
    </aside>
  );
}

export function CreationSidebar() {
  return (
    <Suspense fallback={
      <aside className="fixed left-0 top-12 h-[calc(100vh-3rem)] w-16 bg-[#FDFDF9]">
        <div className="pb-4 pt-4">
          <div className="space-y-4 px-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-stone-200"></div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 right-0 top-0 w-px bg-stone-200/50"></div>
      </aside>
    }>
      <SidebarContent />
    </Suspense>
  );
}
