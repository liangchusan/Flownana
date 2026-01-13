"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CreationSidebar } from "@/components/layout/creation-sidebar";
import { VideoCreationForm } from "@/components/creation/video-creation-form";
import { VideoPreview } from "@/components/creation/video-preview";
import { GenerateForm } from "@/components/generate/generate-form";
import { ImagePreview } from "@/components/generate/image-preview";
import { VoiceCreationForm } from "@/components/creation/voice-creation-form";
import { VoicePreview } from "@/components/creation/voice-preview";
import { Video, Image as ImageIcon, Mic, ArrowRight, Play, Sparkles } from "lucide-react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";

type CreationMode = "video" | "image" | "voice";

function CreateContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const urlMode = searchParams.get("mode") as CreationMode | null;
  const [mode, setMode] = useState<CreationMode | null>(urlMode || null);

  // Update mode when URL parameter changes
  useEffect(() => {
    const newUrlMode = searchParams.get("mode") as CreationMode | null;
    if (newUrlMode && ["video", "image", "voice"].includes(newUrlMode)) {
      setMode(newUrlMode);
    } else {
      setMode(null);
    }
  }, [searchParams]);
  
  // Video state
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  
  // Image state
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  // Voice state
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);

  const modes = [
    { id: "video" as CreationMode, label: "AI Video", icon: Video },
    { id: "image" as CreationMode, label: "AI Image", icon: ImageIcon },
    { id: "voice" as CreationMode, label: "AI Voices", icon: Mic },
  ];

  // Show home navigation page when no mode is selected
  if (!mode) {
    return (
      <div className="flex h-screen overflow-hidden">
        <CreationSidebar />
        <main className="flex-1 overflow-y-auto bg-white">
          {/* Top Bar with Logo and User Info */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-2 flex items-center justify-between">
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
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0"
                >
                  Start Free Now
                </Button>
              )}
            </div>
          </div>

          {/* Home Navigation Page */}
          <div className="max-w-7xl mx-auto px-12 py-12 bg-gray-50 min-h-[calc(100vh-80px)]">
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
              {/* AI Video Card */}
              <Link href="/create?mode=video" className="group">
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

              {/* AI Image Card */}
              <Link href="/create?mode=image" className="group">
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

              {/* AI Voice Card */}
              <Link href="/create?mode=voice" className="group">
                <div className="bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.15)] transition-all duration-300 p-6 border-2 border-gray-300 hover:border-green-400 hover:-translate-y-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-green-500 rounded-lg p-3">
                      <Mic className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">AI Voices</h2>
                  </div>
                  <p className="text-gray-600 mb-4 text-sm">
                    Powered by <span className="font-semibold text-gray-900">Suno</span>, an advanced AI music and voice generation platform.
                  </p>
                  <div className="aspect-video bg-gradient-to-br from-green-50 to-green-100 rounded-lg overflow-hidden mb-4 border border-gray-200">
                    <div className="w-full h-full flex items-center justify-center">
                      <Mic className="h-12 w-12 text-green-500" />
                    </div>
                  </div>
                  <div className="flex items-center text-green-600 font-medium text-sm group-hover:gap-2 transition-all">
                    <span>Try AI Voices</span>
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

  const getTitle = () => {
    switch (mode) {
      case "video":
        return "AI Video";
      case "image":
        return "AI Image";
      case "voice":
        return "AI Voices";
      default:
        return "Create with AI";
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <CreationSidebar />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-white">
        {/* Top Bar with Logo and User Info */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-2 flex items-center justify-between">
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
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0"
              >
                Start Free Now
              </Button>
            )}
          </div>
        </div>

        <div className="flex h-[calc(100vh-73px)]">
          {/* Left: Creation Form */}
          <div className="w-[500px] border-r border-gray-200 overflow-y-auto bg-white p-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
              {getTitle()}
            </h1>
            {mode === "video" && (
              <VideoCreationForm
                onGenerate={setGeneratedVideo}
                isGenerating={isGeneratingVideo}
                setIsGenerating={setIsGeneratingVideo}
              />
            )}
            {mode === "image" && (
              <GenerateForm
                onGenerate={setGeneratedImage}
                isGenerating={isGeneratingImage}
                setIsGenerating={setIsGeneratingImage}
              />
            )}
            {mode === "voice" && (
              <VoiceCreationForm
                onGenerate={setGeneratedAudio}
                isGenerating={isGeneratingVoice}
                setIsGenerating={setIsGeneratingVoice}
              />
            )}
          </div>

          {/* Right: Preview - Full Screen */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
            {mode === "video" && (
              <VideoPreview
                videoUrl={generatedVideo}
                isGenerating={isGeneratingVideo}
              />
            )}
            {mode === "image" && (
              <ImagePreview
                imageUrl={generatedImage}
                isGenerating={isGeneratingImage}
              />
            )}
            {mode === "voice" && (
              <VoicePreview
                audioUrl={generatedAudio}
                isGenerating={isGeneratingVoice}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-white">
        <div className="w-20 bg-white"></div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    }>
      <CreateContent />
    </Suspense>
  );
}
