import type { AnalyticsCollectionPolicy } from "./analytics-collection-policy";

const DISMISSED_KEY = "flownana_analytics_prompt_dismissed";
export const PRIVACY_SETTINGS_EVENT = "flownana:privacy-settings";

export function analyticsPromptDismissed() {
  try { return window.sessionStorage.getItem(DISMISSED_KEY) === "1"; }
  catch { return false; }
}

export function dismissAnalyticsPrompt() {
  try { window.sessionStorage.setItem(DISMISSED_KEY, "1"); }
  catch { /* The component still hides this reminder until the next page load. */ }
}

export function shouldPromptForAnalytics(policy: AnalyticsCollectionPolicy, choice: string | null, dismissed: boolean) {
  return choice === null && (!policy.defaultAnalytics || policy.defaultAdvertising === true) && !policy.gpc && !dismissed;
}
