"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

const errorMessages: Record<string, string> = {
  Configuration: "Server configuration error, please contact administrator",
  AccessDenied: "Access denied",
  Verification: "Verification failed, please try again",
  OAuthSignin: "OAuth sign-in initialization failed. Please check: 1) GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file are correct 2) Redirect URI in Google Cloud Console includes http://localhost:3000/api/auth/callback/google",
  OAuthCallback: "OAuth callback processing failed",
  OAuthCreateAccount: "Unable to create OAuth account",
  EmailCreateAccount: "Unable to create email account",
  Callback: "Callback processing failed",
  OAuthAccountNotLinked: "This email is already associated with another account",
  EmailSignin: "Failed to send verification email",
  CredentialsSignin: "Incorrect username or password",
  SessionRequired: "Login required to access",
  Default: "An unknown error occurred, please try again",
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Default";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDFDF9] px-6 py-8">
      <div className="w-full max-w-md rounded-2xl border border-stone-200/50 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-center">
          <div className="rounded-full bg-red-100 p-3">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>
        
        <h1 className="mb-4 text-center text-2xl font-bold text-stone-900">
          Sign In Failed
        </h1>
        
        <div className="mb-6 rounded-xl border border-red-200/80 bg-red-50 p-4">
          <p className="text-sm text-red-800 whitespace-pre-line">
            {errorMessages[error] || errorMessages.Default}
          </p>
        </div>

        {error === "OAuthSignin" && (
          <div className="mb-6 rounded-xl border border-stone-200/80 bg-stone-50 p-4">
            <p className="mb-2 text-sm font-semibold text-stone-900">Troubleshooting Steps:</p>
            <ol className="list-inside list-decimal space-y-1 text-sm text-stone-700">
              <li>Check terminal console for &quot;NextAuth configuration check&quot; output</li>
              <li>Verify .env file is in project root directory with correct content</li>
              <li>Verify redirect URI is added in Google Cloud Console: <code className="rounded bg-stone-100 px-1">http://localhost:3000/api/auth/callback/google</code></li>
              <li>Restart development server (npm run dev)</li>
            </ol>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link href="/">
            <Button className="w-full">Back to Home</Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Retry Sign In
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FDFDF9] px-6 py-8">
          <Skeleton className="h-64 w-full max-w-md rounded-2xl" />
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
