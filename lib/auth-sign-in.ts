"use client";

import { prepareAnalyticsForSignIn } from "@/lib/analytics-sign-in";
import { hasAnalyticsConsent } from "@/lib/analytics";
import { signIn } from "next-auth/react";
import { getCurrentAuthCallbackUrl } from "@/lib/auth-callback";
import { requestLoginDialog } from "@/lib/login-dialog-store";

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

type LoginOperation = { promise: ReturnType<typeof signIn>; pricing: boolean; started: boolean };
let loginOperation: LoginOperation | null = null;

export function signInForCurrentEnvironment(reopenPricing = false): ReturnType<typeof signIn> {
  return requestLoginDialog(reopenPricing);
}

/** Called only after the explicit Google action in the entry dialog. */
export function continueSignInForCurrentEnvironment(reopenPricing = false): ReturnType<typeof signIn> {
  if (loginOperation) {
    // A plan selected during preparation upgrades the return intent, without a second OAuth.
    if (!loginOperation.started) loginOperation.pricing ||= reopenPricing;
    return loginOperation.promise;
  }
  const callbackUrl = isTestAuthEnabled() && typeof window !== "undefined" ? window.location.href : getCurrentAuthCallbackUrl();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const operation: LoginOperation = { promise: Promise.resolve(undefined), pricing: reopenPricing, started: false };
  const reset = () => {
    if (loginOperation === operation) loginOperation = null;
    if (typeof window !== "undefined") window.removeEventListener("pageshow", returned);
  };
  const returned = (event: PageTransitionEvent) => { if (event.persisted) reset(); };
  if (typeof window !== "undefined") window.addEventListener("pageshow", returned);
  operation.promise = (async () => {
    const synced = await prepareAnalyticsForSignIn();
    operation.started = true;
    const result = await signIn(getSignInProviderId(), {
      callbackUrl: operation.pricing ? new URL(`${callbackUrl.split("#")[0]}#pricing`, origin || "http://localhost").href : callbackUrl,
      analyticsReady: synced && hasAnalyticsConsent() ? "1" : "0",
    });
    if (result?.error) reset();
    // Successful redirect remains latched until navigation, including the response-to-navigation gap.
    return result;
  })().catch(error => { reset(); throw error; });
  loginOperation = operation;
  return operation.promise;
}
