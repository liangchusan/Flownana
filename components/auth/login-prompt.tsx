"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogIn, Sparkles } from "lucide-react";

export function LoginPrompt() {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-8 text-center shadow-sm">
      <div className="flex justify-center mb-6">
        <div className="bg-blue-100 rounded-full p-4">
          <Sparkles className="h-12 w-12 text-blue-500" />
        </div>
      </div>
      
      <h2 className="text-3xl font-bold text-slate-900 mb-4">
        Sign In to Get Started
      </h2>
      
      <p className="text-slate-600 mb-8 max-w-md mx-auto">
        Please sign in to your account to use Flownana AI content generation features.
        We support quick sign in with Google.
      </p>
      
      <Button
        onClick={() => signIn("google")}
        size="lg"
        className="mx-auto flex items-center space-x-2 rounded-full border-0 bg-gradient-to-r from-blue-600 to-blue-700 px-8 text-white shadow-sm transition-all duration-200 hover:from-blue-700 hover:to-blue-800 hover:opacity-90 active:scale-[0.98]"
      >
        <LogIn className="h-5 w-5" />
        <span>Sign in with Google</span>
      </Button>
      
      <p className="text-sm text-slate-500 mt-6">
        By signing in, you agree to our Terms of Service and Privacy Policy
      </p>
    </div>
  );
}
