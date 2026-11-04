import { analyticsPreparationState, syncAnalyticsBrowserBlock, syncAnalyticsContextAttempt } from "./analytics";
import { ADVERTISING_EVENT, advertisingAccountScope } from "./advertising-consent";
import { ACCOUNT_SCOPE_HEADER } from "./account-scope";

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

/** Best effort before OAuth, never invent consent or hold login indefinitely. */
export async function prepareAnalyticsForSignIn(): Promise<boolean> {
  syncAnalyticsBrowserBlock();
  const initial = analyticsPreparationState();
  if (initial === "disabled" || initial === "denied") return false;
  const scope = advertisingAccountScope();
  const controller = new AbortController();
  const { signal } = controller;
  let cancelled = false;
  let reason: string = "policy_pending";
  const check = () => {
    const state = analyticsPreparationState();
    if (advertisingAccountScope() !== scope || state === "denied" || state === "disabled") {
      cancelled = true;
      controller.abort();
    }
  };
  const events = ["flownana:analytics-consent", "storage", ADVERTISING_EVENT];
  for (const event of events) window.addEventListener(event, check);
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    let attempts = 0;
    while (!signal.aborted) {
      check();
      if (signal.aborted) break;
      if (analyticsPreparationState() === "pending" || typeof window.gtag !== "function") {
        reason = analyticsPreparationState() === "pending" ? "policy_pending" : "sdk_unavailable";
        await pause(100, signal);
        continue;
      }
      const result = await syncAnalyticsContextAttempt(scope ? { [ACCOUNT_SCOPE_HEADER]: scope } : {}, signal);
      check();
      if (signal.aborted) break;
      if (result === "synced") return true;
      reason = result;
      if (result === "cancelled") { cancelled = true; break; }
      if (result === "http_rejected" || ++attempts >= 3) break;
      await pause(200, signal);
    }
  } catch { reason = "unexpected_error"; }
  finally {
    clearTimeout(timer);
    controller.abort();
    for (const event of events) window.removeEventListener(event, check);
  }
  // Fixed reason codes only: never log IDs, URLs, campaign parameters or response bodies.
  if (!cancelled) console.warn("[analytics] Login context unavailable:", reason);
  return false;
}
