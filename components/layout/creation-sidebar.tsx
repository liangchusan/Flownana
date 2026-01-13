"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { Video, Image as ImageIcon, Mic, Home } from "lucide-react";

function SidebarContent() {
  const searchParams = useSearchParams();
  const currentMode = searchParams.get("mode");

  const navItems = [
    { id: "video", label: "AI Video", icon: Video, href: "/create?mode=video" },
    { id: "image", label: "AI Image", icon: ImageIcon, href: "/create?mode=image" },
    { id: "voice", label: "AI Voices", icon: Mic, href: "/create?mode=voice" },
  ];

  // Check if we're on the home page (no mode parameter)
  const isHome = !currentMode;

  return (
    <aside className="w-20 bg-white h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-2 pt-4">
        {/* Navigation */}
        <nav className="space-y-1">
          <Link
            href="/create"
            className={`group relative flex items-center justify-center p-3 rounded-lg transition-colors ${
              isHome
                ? "text-blue-600"
                : "text-gray-700 hover:text-gray-900"
            }`}
          >
            <Home className="h-5 w-5" />
            {/* Tooltip on hover */}
            <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50">
              Home
            </span>
          </Link>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentMode === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`group relative flex items-center justify-center p-3 rounded-lg transition-colors ${
                  isActive
                    ? "text-blue-600"
                    : "text-gray-700 hover:text-gray-900"
                }`}
              >
                <Icon className="h-5 w-5" />
                {/* Tooltip on hover */}
                <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export function CreationSidebar() {
  return (
    <Suspense fallback={
      <aside className="w-20 bg-white h-screen fixed left-0 top-0">
        <div className="p-2">
          <div className="space-y-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </aside>
    }>
      <SidebarContent />
    </Suspense>
  );
}
