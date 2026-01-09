"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-red-100 rounded-full p-3">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-4">
          Sign In Failed
        </h1>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800 whitespace-pre-line">
            {errorMessages[error] || errorMessages.Default}
          </p>
        </div>

        {error === "OAuthSignin" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm font-semibold text-blue-900 mb-2">Troubleshooting Steps:</p>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Check terminal console for "NextAuth configuration check" output</li>
              <li>Verify .env file is in project root directory with correct content</li>
              <li>Verify redirect URI is added in Google Cloud Console: <code className="bg-blue-100 px-1 rounded">http://localhost:3000/api/auth/callback/google</code></li>
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
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}

