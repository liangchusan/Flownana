"use client";

import { useState } from "react";
import { CreationSidebar } from "@/components/layout/creation-sidebar";
import { GenerateForm } from "@/components/generate/generate-form";
import { ResultPanel } from "@/components/creation/result-panel";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";

export function CreateContent({ mode }: { mode: "image" }) {
  const { data: session } = useSession();
  
  // Image state
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | undefined>(undefined);
  const [currentPrompt, setCurrentPrompt] = useState<string | undefined>(undefined);

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
              AI Image
            </h1>
            <GenerateForm
              onGenerate={(url, taskId, prompt) => {
                setGeneratedImage(url);
                if (taskId) setCurrentTaskId(taskId);
                if (prompt) setCurrentPrompt(prompt);
              }}
              isGenerating={isGeneratingImage}
              setIsGenerating={setIsGeneratingImage}
              onTaskIdChange={setCurrentTaskId}
            />
          </div>

          {/* Right: Result Panel */}
          <div className="flex-1 overflow-hidden bg-gray-50">
            <ResultPanel
              mode="image"
              currentGeneration={{
                url: generatedImage,
                isGenerating: isGeneratingImage,
                taskId: currentTaskId,
                prompt: currentPrompt,
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
