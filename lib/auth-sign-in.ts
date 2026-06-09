"use client";

import { signIn } from "next-auth/react";
import { getCurrentAuthCallbackUrl } from "@/lib/auth-callback";

export const TEST_AUTH_PROVIDER_ID = "test-login";

export function isTestAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH === "true"
  );
}

export function getSignInProviderId() {
  return isTestAuthEnabled() ? TEST_AUTH_PROVIDER_ID : "google";
}

export function getSignInLabel() {
  return isTestAuthEnabled() ? "Sign in as Test User" : "Sign in with Google";
}

export function signInForCurrentEnvironment() {
  const callbackUrl =
    isTestAuthEnabled() && typeof window !== "undefined"
      ? window.location.href
      : getCurrentAuthCallbackUrl();

  return signIn(getSignInProviderId(), {
    callbackUrl,
  });
}
