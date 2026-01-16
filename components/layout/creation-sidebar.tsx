"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
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
    <aside className="w-[70px] bg-white fixed left-0 top-12 h-[calc(100vh-3rem)] overflow-y-auto">
      <div className="pb-4 pt-4">
        {/* Navigation */}
        <nav className="space-y-4 px-2">
          <Link
            href="/home"
            className={`group flex flex-col items-center gap-1 py-2 rounded-lg transition-colors ${
              isHome
                ? "bg-gray-100 text-blue-600"
                : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
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
                className={`group flex flex-col items-center gap-1 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-gray-100 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
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
      <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-100"></div>
    </aside>
  );
}

export function CreationSidebar() {
  return (
    <Suspense fallback={
      <aside className="w-[70px] bg-white fixed left-0 top-12 h-[calc(100vh-3rem)]">
        <div className="pb-4 pt-4">
          <div className="space-y-4 px-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-100"></div>
      </aside>
    }>
      <SidebarContent />
    </Suspense>
  );
}
