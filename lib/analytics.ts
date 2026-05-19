export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export type AnalyticsEventName =
  | "landing_page_view"
  | "hero_cta_click"
  | "ai_image_entry_click"
  | "signup_started"
  | "signup_completed"
  | "pricing_viewed"
  | "checkout_started"
  | "purchase_success"
  | "generation_started"
  | "generation_success"
  | "generation_failed"
  | "result_download_clicked"
  | "insufficient_credits_shown";

type EventParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: AnalyticsEventName, params: EventParams = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", name, params);
}

export function trackPageView(path: string) {
  if (
    typeof window === "undefined" ||
    typeof window.gtag !== "function" ||
    !GA_MEASUREMENT_ID
  ) {
    return;
  }

  window.gtag("config", GA_MEASUREMENT_ID, {
    page_path: path,
  });
}
