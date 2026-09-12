export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export type AnalyticsEventName =
  | "agent_conversation_started" | "agent_message_submitted" | "agent_quote_viewed" | "agent_limit_reached"
  | "template_view" | "template_click" | "template_input_submit" | "clarification_started" | "clarification_completed" | "variant_selected" | "continued_edit"
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

  window.gtag("event", name, { ...params, ...(window.location?.pathname.startsWith("/agent") ? { page_location: `${window.location.origin}/agent`, page_path: "/agent", page_title: "Agent · Flownana", page_referrer: "" } : {}) });
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
    send_page_view: true,
    page_location: `${window.location.origin}${path}`,
    page_title: document.title,
    page_referrer: document.referrer.includes("/agent") ? "" : document.referrer,
    page_path: path.startsWith("/agent") ? (path.split("?")[0] === "/agent" ? "/agent" : "/agent/[id]") : path,
    ...(path.startsWith("/agent") ? { page_location: `${window.location.origin}/agent`, page_title: "Agent · Flownana", page_referrer: "" } : {}),
  });
}
