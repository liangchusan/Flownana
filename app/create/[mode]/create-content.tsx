"use client";

import { useState } from "react";
import { CreationSidebar } from "@/components/layout/creation-sidebar";
import { VideoCreationForm } from "@/components/creation/video-creation-form";
import { VideoPreview } from "@/components/creation/video-preview";
import { GenerateForm } from "@/components/generate/generate-form";
import { ImagePreview } from "@/components/generate/image-preview";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";
import { signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import { getAccountScope } from "@/lib/account-scope";
import { useAccountOperation } from "@/lib/use-account-operation";

type CreationMode = "video" | "image";

export function CreateContent(props: { mode: CreationMode }) {
  const { data: session } = useSession();
  return <ScopedCreateContent key={getAccountScope(session?.user) || "anonymous"} {...props} />;
}

function ScopedCreateContent({ mode: modeParam }: { mode: CreationMode }) {
  const { capture: captureGeneration } = useAccountOperation();
  const { data: session, status } = useSession();
  
  const mode = modeParam as CreationMode | null;
  
  // Video state
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  
  // Image state
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const getTitle = () => {
    switch (mode) {
      case "video":
        return "AI Video";
      case "image":
        return "AI Image";
      default:
        return "Create with AI";
    }
  };

  if (!mode || !["video", "image"].includes(mode)) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <CreationSidebar />

      {/* Main Content Area */}
      <main className="ml-16 min-w-0 flex-1 overflow-y-auto bg-background">
        {/* Top Bar with Logo and User Info - Full width, above sidebar */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background px-3 py-2 sm:px-8">
          <Link href="/" className="flex-shrink-0">
            <Logo size="md" />
          </Link>
          <div>
            {status === "loading" ? (
              <div className="h-9 w-32 animate-pulse rounded-xl bg-stone-200/80" />
            ) : session ? (
              <UserMenu
                user={{
                  name: session.user?.name,
                  email: session.user?.email,
                  image: session.user?.image,
                }}
              />
            ) : (
              <Button
                onClick={() => signInForCurrentEnvironment()}
                className="rounded-xl border-0 bg-stone-800 px-4 py-1.5 text-sm text-white shadow-sm transition-all duration-300 hover:bg-stone-800/90 active:scale-[0.98]"
                size="sm"
              >
                Start Free Now
              </Button>
            )}
          </div>
        </div>

        {/* Content area with left margin for sidebar */}
        <div className="flex min-h-[calc(100vh-73px)] flex-col lg:h-[calc(100vh-73px)] lg:flex-row">
          {/* Left: Creation Form */}
          <div className="w-full shrink-0 border-b border-border bg-background p-3 sm:p-8 lg:max-w-lg lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <h1 className="mb-8 text-3xl font-bold text-stone-900 md:text-4xl">
              {getTitle()}
            </h1>
            {mode === "video" && (
              <VideoCreationForm
                captureGeneration={captureGeneration}
                onGenerate={setGeneratedVideo}
                isGenerating={isGeneratingVideo}
                setIsGenerating={setIsGeneratingVideo}
              />
            )}
            {mode === "image" && (
              <GenerateForm
                captureGeneration={captureGeneration}
                onGenerate={setGeneratedImage}
                isGenerating={isGeneratingImage}
                setIsGenerating={setIsGeneratingImage}
              />
            )}
          </div>

          {/* Right: Preview - Full Screen */}
          <div className="min-w-0 flex-1 bg-background p-3 sm:p-8 lg:overflow-y-auto">
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
          </div>
        </div>
      </main>
    </div>
  );
}
