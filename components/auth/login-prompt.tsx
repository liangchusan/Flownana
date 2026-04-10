"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogIn, Sparkles } from "lucide-react";

export function LoginPrompt() {
  return (
    <div className="rounded-2xl border border-stone-200/50 bg-white p-8 text-center shadow-sm">
      <div className="mb-6 flex justify-center">
        <div className="rounded-full bg-stone-100 p-4">
          <Sparkles className="h-12 w-12 text-stone-500" />
        </div>
      </div>
      
      <h2 className="mb-4 text-3xl font-bold text-stone-900">
        Sign In to Get Started
      </h2>
      
      <p className="mx-auto mb-8 max-w-md text-stone-600">
        Please sign in to your account to use Flownana AI content generation features.
        We support quick sign in with Google.
      </p>
      
      <Button
        onClick={() => signIn("google")}
        size="lg"
        className="mx-auto flex items-center space-x-2 rounded-xl border-0 bg-stone-800 px-8 text-white shadow-sm transition-all duration-300 hover:bg-stone-800/90 active:scale-[0.98]"
      >
        <LogIn className="h-5 w-5" />
        <span>Sign in with Google</span>
      </Button>
      
      <p className="mt-6 text-sm text-stone-500">
        By signing in, you agree to our Terms of Service and Privacy Policy
      </p>
    </div>
  );
}
