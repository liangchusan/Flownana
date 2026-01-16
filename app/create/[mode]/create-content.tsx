"use client";

import { useState } from "react";
import { CreationSidebar } from "@/components/layout/creation-sidebar";
import { VideoCreationForm } from "@/components/creation/video-creation-form";
import { VideoPreview } from "@/components/creation/video-preview";
import { GenerateForm } from "@/components/generate/generate-form";
import { ImagePreview } from "@/components/generate/image-preview";
import { VoiceCreationForm } from "@/components/creation/voice-creation-form";
import { VoicePreview } from "@/components/creation/voice-preview";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";

type CreationMode = "video" | "image" | "voice";

export function CreateContent({ mode: modeParam }: { mode: CreationMode }) {
  const { data: session } = useSession();
  
  const mode = modeParam as CreationMode | null;
  
  // Video state
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  
  // Image state
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  // Voice state
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);

  const getTitle = () => {
    switch (mode) {
      case "video":
        return "AI Video";
      case "image":
        return "AI Image";
      case "voice":
        return "AI Music";
      default:
        return "Create with AI";
    }
  };

  if (!mode || !["video", "image", "voice"].includes(mode)) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <CreationSidebar />

      {/* Main Content Area */}
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

        {/* Content area with left margin for sidebar */}
        <div className="flex h-[calc(100vh-73px)] ml-[70px]">
          {/* Left: Creation Form */}
          <div className="w-[420px] overflow-y-auto bg-white border-r border-gray-100 p-8">
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
