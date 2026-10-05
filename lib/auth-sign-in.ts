"use client";

import { syncAnalyticsContext } from "@/lib/analytics";
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

export async function signInForCurrentEnvironment(reopenPricing = false) {
  const callbackUrl =
    reopenPricing && typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}${window.location.search}#pricing`
      : isTestAuthEnabled() && typeof window !== "undefined"
      ? window.location.href
      : getCurrentAuthCallbackUrl();

  await syncAnalyticsContext();
  return signIn(getSignInProviderId(), {
    callbackUrl,
  });
}
