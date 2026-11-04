import { ANALYTICS_BLOCK_COOKIE, allowedAnalyticsHost, safePage, TEST_GA_ID, validContext, type AnalyticsContext, type CommerceEvent } from "./analytics-policy";
import { analyticsCollectionBasis, type AnalyticsCollectionPolicy } from "./analytics-collection-policy";
import { advertisingAccountScope, configureAdvertisingDefault, hasAdvertisingConsent, revokeAdvertising } from "./advertising-consent";
import { ACCOUNT_SCOPE_HEADER } from "./account-scope";
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
export const GA_ENABLED = process.env.NEXT_PUBLIC_GA_ENABLED === "true";
export type AnalyticsEventName = "page_view" | "pricing_view" | "begin_checkout";
type EventParams = Record<string, unknown>;
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; [key: `ga-disable-${string}`]: boolean | undefined; } }
const checkoutReported = new Set<string>();
let consentDenied = false;
let collectionPolicy: AnalyticsCollectionPolicy | null = null;
export function analyticsChoice(): string | null {
  try { return window.localStorage.getItem("flownana_analytics_consent") ?? null; } catch { return "denied"; }
}
export function configureAnalyticsCollection(policy: AnalyticsCollectionPolicy) {
  const previouslyGpc = collectionPolicy?.gpc;
  collectionPolicy = policy;
  configureAdvertisingDefault(policy.defaultAdvertising === true && analyticsCollectionBasis(policy, analyticsChoice()) !== null);
  if (policy.gpc && !previouslyGpc) requestAnalyticsRevocation();
  syncAnalyticsBrowserBlock();
  window.dispatchEvent(new Event("flownana:analytics-consent"));
}
const REVOCATION_KEY = "flownana_analytics_revocation_pending";
let revocationPending = false;
let revocationVersion = 0;
let revocationRequest: Promise<boolean> | null = null;
function hasPendingRevocation() {
  if (revocationPending) return true;
  try { return !!window.localStorage.getItem(REVOCATION_KEY); } catch { return false; }
}
export function hasAnalyticsConsent() {
  if (typeof window === "undefined" || consentDenied || hasPendingRevocation()) return false;
  return analyticsCollectionBasis(collectionPolicy, analyticsChoice()) !== null;
}
// This cookie can only restrict server collection, including when DELETE is offline.
// Do not clear it until the latest local permission and withdrawal state allow collection.
export function syncAnalyticsBrowserBlock() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blocked = !hasAnalyticsConsent() || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  try { document.cookie = `${ANALYTICS_BLOCK_COOKIE}=${blocked ? "1" : ""}; Path=/; SameSite=Lax; Max-Age=${blocked ? 180 * 86400 : 0}${window.location.protocol === "https:" ? "; Secure" : ""}`; }
  catch { /* Collection still fails closed locally; the callback also checks server GPC/region. */ }
}
export function setTagDisabled(disabled: boolean) {
  if (GA_MEASUREMENT_ID && typeof window !== "undefined") window[`ga-disable-${GA_MEASUREMENT_ID}`] = disabled;
}
// Keep failed withdrawal durable across refreshes; do not resume before the server acknowledges it.
export function reconcileAnalyticsRevocation(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (revocationRequest) return revocationRequest;
  if (!hasPendingRevocation()) return Promise.resolve(true);
  const version = revocationVersion;
  let marker: string | null | undefined;
  try { marker = window.localStorage.getItem(REVOCATION_KEY); } catch { /* Still try to revoke the server context. */ }
  revocationRequest = (async () => {
    try {
      const scope = advertisingAccountScope();
      const response = await fetch("/api/analytics/context", { method: "DELETE", headers: scope ? { [ACCOUNT_SCOPE_HEADER]: scope } : {}, keepalive: true, signal: AbortSignal.timeout(5000) });
      if (!response.ok || version !== revocationVersion || (marker !== undefined && window.localStorage.getItem(REVOCATION_KEY) !== marker)) return false;
      // A failed storage update must keep collection blocked on subsequent loads.
      window.localStorage.removeItem(REVOCATION_KEY);
      revocationPending = false;
      syncAnalyticsBrowserBlock();
      window.dispatchEvent(new Event("flownana:analytics-consent"));
      return true;
    } catch { return false; }
    finally { revocationRequest = null; }
  })();
  return revocationRequest;
}
function requestAnalyticsRevocation() {
  revocationPending = true;
  revocationVersion++;
  syncAnalyticsBrowserBlock();
  revokeAdvertising();
  try { window.localStorage.setItem(REVOCATION_KEY, crypto.randomUUID()); } catch { /* Memory remains blocked. */ }
  setTagDisabled(true);
  window.gtag?.("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  checkoutReported.clear();
  void reconcileAnalyticsRevocation();
}
export function analyticsRevocationPending() { return hasPendingRevocation(); }
export function setAnalyticsConsent(granted: boolean) {
  consentDenied = !granted;
  try { window.localStorage.setItem("flownana_analytics_consent", granted ? "granted" : "denied"); } catch { /* Fail closed. */ }
  configureAdvertisingDefault(granted && collectionPolicy?.defaultAdvertising === true && hasAnalyticsConsent());
  if (!granted) requestAnalyticsRevocation();
  syncAnalyticsBrowserBlock();
  const allowed = granted && hasAnalyticsConsent() && GA_ENABLED && !!GA_MEASUREMENT_ID && allowedAnalyticsHost(GA_MEASUREMENT_ID, window.location.hostname);
  setTagDisabled(!allowed);
  const ads = allowed && hasAdvertisingConsent() ? "granted" : "denied";
  window.gtag?.("consent", "update", { analytics_storage: allowed ? "granted" : "denied", ad_storage: ads, ad_user_data: ads, ad_personalization: "denied" });
  window.dispatchEvent(new Event("flownana:analytics-consent"));
  if (hasPendingRevocation()) void reconcileAnalyticsRevocation();
}
export function canTrack() {
  return GA_ENABLED && !!GA_MEASUREMENT_ID && typeof window !== "undefined" &&
    allowedAnalyticsHost(GA_MEASUREMENT_ID, window.location.hostname) && hasAnalyticsConsent() && typeof window.gtag === "function";
}
export function trackEvent(name: AnalyticsEventName, params: EventParams = {}) {
  if (!canTrack() || !["page_view", "pricing_view", "begin_checkout"].includes(name)) return false;
  window.gtag!("event", name, { ...params, ...safePage(window.location.href, window.location.origin, document.referrer),
    send_to: GA_MEASUREMENT_ID, ...(GA_MEASUREMENT_ID === TEST_GA_ID ? { debug_mode: true } : {}) });
  return true;
}
export function trackPageView(path: string) { return trackEvent("page_view", safePage(path, window.location.origin, document.referrer)); }
export function trackCheckout(checkout: { id?: string; url?: string; event?: CommerceEvent }) {
  if (!checkout.id || !checkout.event || !checkout.url || checkoutReported.has(checkout.id)) return false;
  try { const url = new URL(checkout.url); if (url.hostname !== "checkout.stripe.com" || url.protocol !== "https:") return false; } catch { return false; }
  let stored = false;
  try { stored = window.localStorage.getItem(`flownana:checkout:${checkout.id}`) === "1"; } catch { /* Memory fallback. */ }
  if (stored || !trackEvent("begin_checkout", checkout.event)) return false;
  checkoutReported.add(checkout.id);
  try { window.localStorage.setItem(`flownana:checkout:${checkout.id}`, "1"); } catch { /* Memory fallback. */ }
  return true;
}
// A pending policy is different from a deliberate refusal; login may briefly wait for it.
export function analyticsPreparationState(): "disabled" | "pending" | "denied" | "ready" {
  if (!GA_ENABLED || !GA_MEASUREMENT_ID || typeof window === "undefined" || !allowedAnalyticsHost(GA_MEASUREMENT_ID, window.location.hostname)) return "disabled";
  if (consentDenied || hasPendingRevocation() || analyticsChoice() === "denied" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return "denied";
  if (!collectionPolicy) return "pending";
  return hasAnalyticsConsent() ? "ready" : "denied";
}
export async function captureAnalyticsContext(signal?: AbortSignal): Promise<AnalyticsContext | null> {
  if (!canTrack() || signal?.aborted) return null;
  const get = (field: string) => new Promise<unknown>((resolve) => {
    const finish = (value: unknown) => { clearTimeout(timer); signal?.removeEventListener("abort", abort); resolve(value); };
    const abort = () => finish(null);
    const timer = setTimeout(abort, 1500);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    try { window.gtag!("get", GA_MEASUREMENT_ID, field, finish); } catch { finish(null); }
  });
  const initial = await Promise.all([get("client_id"), get("session_id")]);
  if (signal?.aborted || !canTrack() || typeof initial[0] !== "string" || !Number.isSafeInteger(Number(initial[1])) || Number(initial[1]) <= 0) return null;
  // During initial SDK startup, session initialization can replace a provisional client ID.
  // Read the pair again through the official API, rather than sending the early identifier.
  const [clientId, sessionId] = await Promise.all([get("client_id"), get("session_id")]);
  if (signal?.aborted || !canTrack() || typeof clientId !== "string" || !Number.isSafeInteger(Number(sessionId))) return null;
  return validContext({ clientId, sessionId: Number(sessionId), capturedAt: Date.now(), measurementId: GA_MEASUREMENT_ID!,
    collectionBasis: analyticsCollectionBasis(collectionPolicy, analyticsChoice())! }, GA_MEASUREMENT_ID!);
}

export type AnalyticsSyncResult = "synced" | "context_unavailable" | "network_error" | "retryable_http" | "http_rejected" | "cancelled";
export async function syncAnalyticsContextAttempt(headers: Record<string, string> = {}, signal?: AbortSignal): Promise<AnalyticsSyncResult> {
  const context = await captureAnalyticsContext(signal);
  if (signal?.aborted || !hasAnalyticsConsent()) return "cancelled";
  if (!context) return "context_unavailable";
  const request = new AbortController();
  const abort = () => request.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 2000);
  try {
    const response = await fetch("/api/analytics/context", {
      method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(context), signal: request.signal,
    });
    if (signal?.aborted || !hasAnalyticsConsent()) return "cancelled";
    if (response.ok) return "synced";
    return response.status === 408 || response.status === 429 || response.status >= 500 ? "retryable_http" : "http_rejected";
  } catch { return signal?.aborted ? "cancelled" : "network_error"; }
  finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
export async function syncAnalyticsContext(headers: Record<string, string> = {}) {
  return await syncAnalyticsContextAttempt(headers) === "synced";
}
