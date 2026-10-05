export const PRODUCTION_GA_ID = "G-2PTWF8DJE2";
export const TEST_GA_ID = "G-RP4MTRCXT0";
export const ANALYTICS_COOKIE = "flownana_analytics";
export const CONTEXT_MAX_AGE_MS = 72 * 60 * 60_000;
export type AnalyticsContext = { clientId: string; sessionId: number; capturedAt: number; measurementId: string; collectionBasis?: "explicit" | "regional_default" };

export function measurementIdForEnvironment(environment: string | undefined, id: string | undefined) {
  const expected = environment === "production" ? PRODUCTION_GA_ID : TEST_GA_ID;
  return id === expected ? id : null;
}
export function allowedAnalyticsHost(id: string, hostname: string) {
  if (id === PRODUCTION_GA_ID) return ["flownana.com", "www.flownana.com"].includes(hostname);
  return id === TEST_GA_ID && (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".vercel.app"));
}
// Safe routes and campaign tokens only; never arbitrary paths, titles or query strings.
export function safePage(path: string, origin: string, referrer = "") {
  const url = new URL(path, origin);
  const known = ["/", "/image", "/video", "/agent", "/assets", "/pricing", "/explore", "/creations", "/account/billing", "/account/profile", "/privacy-policy", "/terms-of-service"];
  const route = url.pathname.startsWith("/agent/") ? "/agent" : known.includes(url.pathname) ? url.pathname : "/other";
  const query = new URLSearchParams();
  if (route === "/") for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "gbraid", "wbraid"]) {
    const value = url.searchParams.get(key);
    if (value && value.length <= 100 && /^[a-zA-Z0-9_.~-]+$/.test(value)) query.set(key, value);
  }
  let safeReferrer = "";
  try { const previous = new URL(referrer); if (["https:", "http:"].includes(previous.protocol)) safeReferrer = previous.origin; } catch { /* No referrer. */ }
  return { page_location: `${origin}${route}${query.size ? `?${query}` : ""}`, page_path: route,
    page_title: `${route === "/" ? "Home" : route.slice(1)} · Flownana`, page_referrer: safeReferrer };
}
export function validContext(value: unknown, measurementId: string, now = Date.now()): AnalyticsContext | null {
  const c = value as AnalyticsContext | null;
  return c && c.measurementId === measurementId && typeof c.clientId === "string" && /^\d{1,20}\.\d{1,20}$/.test(c.clientId) &&
    Number.isSafeInteger(c.sessionId) && c.sessionId > 0 && Number.isSafeInteger(c.capturedAt) &&
    c.capturedAt <= now && now - c.capturedAt < CONTEXT_MAX_AGE_MS &&
    (c.collectionBasis === undefined || c.collectionBasis === "explicit" || c.collectionBasis === "regional_default")
      ? { clientId: c.clientId, sessionId: c.sessionId, capturedAt: c.capturedAt, measurementId: c.measurementId,
        ...(c.collectionBasis ? { collectionBasis: c.collectionBasis } : {}) } : null;
}
export type CommerceItem = { item_id: string; item_name: string; price: number; quantity: number };
export type CommerceEvent = { currency: string; value: number; items: CommerceItem[]; tax?: number; transaction_id?: string; purchase_type?: string };
export function commerceEvent(priceKey: string, cents: number, currency: string): CommerceEvent | null {
  if (!/^(starter|pro|max)_(monthly|yearly)$/.test(priceKey) || currency.toUpperCase() !== "USD" || !Number.isSafeInteger(cents) || cents < 0) return null;
  return { currency: "USD", value: cents / 100, items: [{ item_id: priceKey, item_name: priceKey.replace("_", " "), price: cents / 100, quantity: 1 }] };
}
