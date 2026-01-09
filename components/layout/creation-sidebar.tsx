"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { Video, Image as ImageIcon, Mic, Home } from "lucide-react";

function SidebarContent() {
  const searchParams = useSearchParams();
  const currentMode = searchParams.get("mode") || "video";

  const navItems = [
    { id: "video", label: "AI Video", icon: Video, href: "/create?mode=video" },
    { id: "image", label: "AI Image", icon: ImageIcon, href: "/create?mode=image" },
    { id: "voice", label: "AI Voices", icon: Mic, href: "/create?mode=voice" },
  ];

  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-6">
        {/* Logo */}
        <Link href="/" className="block mb-8">
          <Logo size="sm" />
        </Link>

        {/* Navigation */}
        <nav className="space-y-2">
          <Link
            href="/create"
            className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
          >
            <Home className="h-5 w-5" />
            <span className="text-sm font-medium">Home</span>
          </Link>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentMode === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-white text-blue-600 border border-gray-200 shadow-sm"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.label}</span>
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
      <aside className="w-64 bg-gray-50 border-r border-gray-200 h-screen fixed left-0 top-0">
        <div className="p-6">
          <div className="h-8 bg-gray-200 rounded mb-8"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </aside>
    }>
      <SidebarContent />
    </Suspense>
  );
}
