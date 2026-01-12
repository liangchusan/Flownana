"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogIn, Sparkles } from "lucide-react";

export function LoginPrompt() {
  return (
    <div className="bg-white rounded-lg shadow-xl p-8 text-center">
      <div className="flex justify-center mb-6">
        <div className="bg-blue-100 rounded-full p-4">
          <Sparkles className="h-12 w-12 text-blue-500" />
        </div>
      </div>
      
      <h2 className="text-3xl font-bold text-gray-900 mb-4">
        Sign In to Get Started
      </h2>
      
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        Please sign in to your account to use Flownana AI content generation features.
        We support quick sign in with Google.
      </p>
      
      <Button
        onClick={() => signIn("google")}
        size="lg"
        className="flex items-center space-x-2 mx-auto"
      >
        <LogIn className="h-5 w-5" />
        <span>Sign in with Google</span>
      </Button>
      
      <p className="text-sm text-gray-500 mt-6">
        By signing in, you agree to our Terms of Service and Privacy Policy
      </p>
    </div>
  );
}
