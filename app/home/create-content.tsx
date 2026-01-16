"use client";

import { CreationSidebar } from "@/components/layout/creation-sidebar";
import { Video, Image as ImageIcon, Music, ArrowRight, Play, Sparkles } from "lucide-react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";

export function CreateContent() {
  const { data: session } = useSession();

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

        {/* Home Navigation Page - Content starts below top bar with left margin for sidebar */}
        <div className="max-w-7xl mx-auto px-12 py-12 bg-gray-50 min-h-[calc(100vh-80px)] ml-[70px]">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4 mr-2" />
              Powered by Advanced AI
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
              Create Anything with AI
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Generate stunning videos, images, and voices with simple text prompts.
            </p>
          </div>

          {/* Floating Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* AI Image Card */}
            <Link href="/ai-image" className="group">
              <div className="bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.15)] transition-all duration-300 p-6 border-2 border-gray-300 hover:border-purple-400 hover:-translate-y-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-purple-500 rounded-lg p-3">
                    <ImageIcon className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">AI Image</h2>
                </div>
                <p className="text-gray-600 mb-4 text-sm">
                  Powered by <span className="font-semibold text-gray-900">Nano Banana</span>, a breakthrough AI model for photorealistic images.
                </p>
                <div className="aspect-square bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg overflow-hidden mb-4 border border-gray-200">
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-purple-500" />
                  </div>
                </div>
                <div className="flex items-center text-purple-600 font-medium text-sm group-hover:gap-2 transition-all">
                  <span>Try AI Image</span>
                  <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* AI Video Card */}
            <Link href="/ai-video" className="group">
              <div className="bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.15)] transition-all duration-300 p-6 border-2 border-gray-300 hover:border-blue-400 hover:-translate-y-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-500 rounded-lg p-3">
                    <Video className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">AI Video</h2>
                </div>
                <p className="text-gray-600 mb-4 text-sm">
                  Powered by <span className="font-semibold text-gray-900">VEO 3.1</span>, Google's most advanced video generation model.
                </p>
                <div className="aspect-video bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg overflow-hidden mb-4 border border-gray-200">
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="h-12 w-12 text-blue-500" />
                  </div>
                </div>
                <div className="flex items-center text-blue-600 font-medium text-sm group-hover:gap-2 transition-all">
                  <span>Try AI Video</span>
                  <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* AI Music Card */}
            <Link href="/ai-music" className="group">
              <div className="bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.15)] transition-all duration-300 p-6 border-2 border-gray-300 hover:border-green-400 hover:-translate-y-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-green-500 rounded-lg p-3">
                    <Music className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">AI Music</h2>
                </div>
                <p className="text-gray-600 mb-4 text-sm">
                  Powered by <span className="font-semibold text-gray-900">Suno</span>, an advanced AI music and voice generation platform.
                </p>
                <div className="aspect-video bg-gradient-to-br from-green-50 to-green-100 rounded-lg overflow-hidden mb-4 border border-gray-200">
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="h-12 w-12 text-green-500" />
                  </div>
                </div>
                <div className="flex items-center text-green-600 font-medium text-sm group-hover:gap-2 transition-all">
                  <span>Try AI Music</span>
                  <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
