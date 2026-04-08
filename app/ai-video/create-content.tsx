"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CreationSidebar } from "@/components/layout/creation-sidebar";
import { VideoCreationForm } from "@/components/creation/video-creation-form";
import { ResultPanel } from "@/components/creation/result-panel";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";

export function CreateContent({ mode }: { mode: "video" }) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  // Video state
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | undefined>(undefined);
  const [currentPrompt, setCurrentPrompt] = useState<string | undefined>(undefined);
  const [similarPrompt, setSimilarPrompt] = useState<string | undefined>(undefined);
  const [similarImage, setSimilarImage] = useState<string | undefined>(undefined);

  // Sync initial prompt/image from URL (?prompt=... & ?image=...)
  useEffect(() => {
    const q = searchParams.get("prompt");
    const img = searchParams.get("image");
    if (q) setSimilarPrompt(decodeURIComponent(q));
    if (img) setSimilarImage(decodeURIComponent(img));
  }, [searchParams]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <CreationSidebar />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-white">
        {/* Top Bar with Logo and User Info - Full width, above sidebar */}
        <div className="sticky top-0 z-20 bg-white px-8 py-2 flex items-center justify-between border-b border-slate-200/60">
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
                className="rounded-full border-0 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-1.5 text-sm text-white shadow-sm transition-all duration-200 hover:from-blue-700 hover:to-blue-800 hover:opacity-90 active:scale-[0.98]"
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
          <div className="w-[420px] overflow-y-auto bg-white border-r border-slate-200/60 p-8">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-8">
              AI Video
            </h1>
            <VideoCreationForm
              onGenerate={(url, taskId, prompt) => {
                setGeneratedVideo(url);
                if (taskId) setCurrentTaskId(taskId);
                if (prompt) setCurrentPrompt(prompt);
              }}
              isGenerating={isGeneratingVideo}
              setIsGenerating={setIsGeneratingVideo}
              onTaskIdChange={setCurrentTaskId}
              initialPrompt={similarPrompt}
              initialImage={similarImage}
            />
          </div>

          {/* Right: Result Panel */}
          <div className="flex-1 overflow-hidden bg-slate-50">
            <ResultPanel
              mode="video"
              currentGeneration={{
                url: generatedVideo,
                isGenerating: isGeneratingVideo,
                taskId: currentTaskId,
                prompt: currentPrompt,
              }}
              onGenerateSimilar={(data) => {
                setSimilarPrompt(data.prompt);
                setSimilarImage(data.imageUrl);
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
