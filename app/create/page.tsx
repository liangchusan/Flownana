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
        <main className="flex-1 ml-64 overflow-y-auto bg-white">
          {/* Top Bar with User Info */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-4 flex justify-end items-center">
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

          {/* Home Navigation Page */}
          <div className="max-w-7xl mx-auto px-12 py-16">
            <div className="text-center mb-16">
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

            {/* AI Video Section */}
            <section className="mb-20">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-500 rounded-lg p-3">
                      <Video className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900">AI Video</h2>
                  </div>
                  <p className="text-lg text-gray-600 mb-4">
                    Powered by <span className="font-semibold text-gray-900">VEO 3.1</span>, Google's most advanced video generation model. Create professional videos from text prompts or images with stunning quality and realism.
                  </p>
                  <ul className="space-y-2 mb-6 text-gray-600">
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      <span>Text-to-video and image-to-video generation</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      <span>Multiple aspect ratios and durations</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      <span>Cinematic quality with natural motion</span>
                    </li>
                  </ul>
                  <Link href="/create?mode=video">
                    <Button size="lg" className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0">
                      Try AI Video
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
                <div className="relative">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl overflow-hidden shadow-xl">
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <Play className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">VEO 3.1 Video Example</p>
                        <p className="text-sm text-gray-500 mt-2">Professional quality video generation</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* AI Image Section */}
            <section className="mb-20">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="order-2 lg:order-1">
                  <div className="relative">
                    <div className="aspect-square bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl overflow-hidden shadow-xl">
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <ImageIcon className="h-16 w-16 text-purple-600 mx-auto mb-4" />
                          <p className="text-gray-600 font-medium">Nano Banana Image Example</p>
                          <p className="text-sm text-gray-500 mt-2">Stunning AI-generated visuals</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="order-1 lg:order-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-purple-500 rounded-lg p-3">
                      <ImageIcon className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900">AI Image</h2>
                  </div>
                  <p className="text-lg text-gray-600 mb-4">
                    Powered by <span className="font-semibold text-gray-900">Nano Banana</span>, a breakthrough AI model that delivers photorealistic images with world knowledge integration and character consistency.
                  </p>
                  <ul className="space-y-2 mb-6 text-gray-600">
                    <li className="flex items-start">
                      <span className="text-purple-500 mr-2">•</span>
                      <span>Text-to-image and image editing</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-500 mr-2">•</span>
                      <span>Multi-image fusion and character consistency</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-500 mr-2">•</span>
                      <span>Natural language targeted editing</span>
                    </li>
                  </ul>
                  <Link href="/create?mode=image">
                    <Button size="lg" className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white border-0">
                      Try AI Image
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </section>

            {/* AI Voice Section */}
            <section>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-green-500 rounded-lg p-3">
                      <Mic className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900">AI Voices</h2>
                  </div>
                  <p className="text-lg text-gray-600 mb-4">
                    Powered by <span className="font-semibold text-gray-900">Suno</span>, an advanced AI music and voice generation platform. Create natural-sounding voices, music, and voiceovers in multiple languages and styles.
                  </p>
                  <ul className="space-y-2 mb-6 text-gray-600">
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      <span>Text-to-voice and music generation</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      <span>Multiple languages and voice styles</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      <span>Professional-quality audio output</span>
                    </li>
                  </ul>
                  <Link href="/create?mode=voice">
                    <Button size="lg" className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white border-0">
                      Try AI Voices
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
                <div className="relative">
                  <div className="aspect-video bg-gradient-to-br from-green-100 to-green-200 rounded-2xl overflow-hidden shadow-xl">
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <Mic className="h-16 w-16 text-green-600 mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">Suno Audio Example</p>
                        <p className="text-sm text-gray-500 mt-2">Natural-sounding voice generation</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  const getTitle = () => {
    switch (mode) {
      case "video":
        return "The AI video generator built for video creators";
      case "image":
        return "The AI image generator built for creators";
      case "voice":
        return "The AI voice generator built for creators";
      default:
        return "Create with AI";
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <CreationSidebar />

      {/* Main Content Area */}
      <main className="flex-1 ml-64 overflow-y-auto bg-white">
        {/* Top Bar with User Info */}
        <div className="sticky top-0 z-10 bg-white px-8 py-4 flex justify-end items-center">
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
        <div className="w-64 bg-gray-50 border-r border-gray-200"></div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    }>
      <CreateContent />
    </Suspense>
  );
}
