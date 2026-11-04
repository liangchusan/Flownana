export const PRODUCTION_GA_ID = "G-2PTWF8DJE2";
export const TEST_GA_ID = "G-RP4MTRCXT0";
export const ANALYTICS_COOKIE = "flownana_analytics";
// A restrictive preference only. Its absence never creates analytics consent.
export const ANALYTICS_BLOCK_COOKIE = "flownana_analytics_blocked";
export const CONTEXT_MAX_AGE_MS = 72 * 60 * 60_000;
export type AnalyticsContext = { clientId: string; sessionId: number; capturedAt: number; measurementId: string; collectionBasis?: "explicit" | "regional_default"; collectionCountry?: string; withdrawalToken?: string };

export function measurementIdForEnvironment(environment: string | undefined, id: string | undefined) {
  const expected = environment === "production" ? PRODUCTION_GA_ID : TEST_GA_ID;
  return id === expected ? id : null;
}
export function allowedAnalyticsHost(id: string, hostname: string) {
  if (id === PRODUCTION_GA_ID) return ["flownana.com", "www.flownana.com"].includes(hostname);
  return id === TEST_GA_ID && (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".vercel.app"));
}
const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "gbraid", "wbraid"] as const;
const CLICK_KEYS = ["gclid", "gbraid", "wbraid"] as const;
const PUBLIC_CAMPAIGN_PATHS = ["/", "/image", "/video", "/pricing", "/agent"];
export function publicCampaignHref(destination: string, currentHref: string) {
  const source = new URL(currentHref);
  const target = new URL(destination, source);
  if (target.origin !== source.origin || !PUBLIC_CAMPAIGN_PATHS.includes(source.pathname) || !PUBLIC_CAMPAIGN_PATHS.includes(target.pathname)) return destination;
  const combined = new URLSearchParams(target.search);
  for (const [key, value] of safeCampaignQuery(source.searchParams).query) if (!combined.has(key)) combined.set(key, value);
  const campaign = safeCampaignQuery(combined).query;
  for (const key of CAMPAIGN_KEYS) target.searchParams.delete(key);
  for (const [key, value] of campaign) target.searchParams.set(key, value);
  return `${target.pathname}${target.search}${target.hash}`;
}
// The budget counts encoded characters, not Unicode code points. Never truncate an ID.
export function safeCampaignQuery(search: URLSearchParams, budget = 1500) {
  const accepted = new Map<string, string>();
  const rejected: Record<string, number> = {};
  const reject = (reason: string) => { rejected[reason] = (rejected[reason] || 0) + 1; };
  const priority = [...CLICK_KEYS, ...CAMPAIGN_KEYS.filter(key => !CLICK_KEYS.includes(key as typeof CLICK_KEYS[number]))];
  let used = 0;
  for (const key of priority) {
    const values = search.getAll(key);
    if (!values.length) continue;
    if (new Set(values).size > 1) { reject("conflicting_values"); continue; }
    const click = CLICK_KEYS.includes(key as typeof CLICK_KEYS[number]);
    const value = click ? values[0] : values[0].normalize("NFC");
    if (!value || value.length > (click ? 512 : 200)) { reject("length"); continue; }
    if (click ? !/^[a-zA-Z0-9_.~-]+$/.test(value) :
        /[\p{Cc}\p{Cf}\p{Cs}]/u.test(value) || !/^[\p{L}\p{N}\p{M} ._~()\-]+$/u.test(value)) { reject("characters"); continue; }
    if (!click && (/https?/i.test(value) || /(?:bearer|token|secret|session)[ _.-]?/i.test(value) ||
        /^[\w-]{8,}\.[\w-]{8,}\.[\w-]+$/.test(value))) { reject("sensitive_shape"); continue; }
    const encoded = new URLSearchParams([[key, value]]).toString();
    const size = encoded.length + (accepted.size ? 1 : 0);
    if (used + size > Math.max(0, budget)) { reject("budget"); continue; }
    used += size; accepted.set(key, value);
  }
  const query = new URLSearchParams();
  for (const key of CAMPAIGN_KEYS) if (accepted.has(key)) query.set(key, accepted.get(key)!);
  return { query, rejected };
}
// Safe routes and campaign tokens only; never arbitrary paths, titles or query strings.
export function safePage(path: string, origin: string, referrer = "") {
  const url = new URL(path, origin);
  const known = ["/", "/image", "/video", "/agent", "/assets", "/pricing", "/explore", "/creations", "/account/billing", "/account/profile", "/privacy-policy", "/terms-of-service"];
  const route = url.pathname.startsWith("/agent/") ? "/agent" : known.includes(url.pathname) ? url.pathname : "/other";
  const publicEntry = ["/", "/image", "/video", "/pricing", "/agent"].includes(url.pathname);
  const query = publicEntry ? safeCampaignQuery(url.searchParams, Math.min(1500, Math.max(0, 2000 - `${origin}${route}?`.length))).query : new URLSearchParams();
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
    (c.collectionBasis === undefined || c.collectionBasis === "explicit" || c.collectionBasis === "regional_default") &&
    (c.collectionCountry === undefined || /^[A-Z]{2}$/.test(c.collectionCountry))
      ? { clientId: c.clientId, sessionId: c.sessionId, capturedAt: c.capturedAt, measurementId: c.measurementId,
        ...(c.collectionBasis ? { collectionBasis: c.collectionBasis } : {}), ...(c.collectionCountry ? { collectionCountry: c.collectionCountry } : {}),
        ...(typeof c.withdrawalToken === "string" && /^[a-f0-9]{64}$/.test(c.withdrawalToken) ? { withdrawalToken: c.withdrawalToken } : {}) } : null;
}
export type CommerceItem = { item_id: string; item_name: string; price: number; quantity: number };
export type CommerceEvent = { currency: string; value: number; items: CommerceItem[]; tax?: number; transaction_id?: string; purchase_type?: string };
export function commerceEvent(priceKey: string, cents: number, currency: string): CommerceEvent | null {
  if (!/^(starter|pro|max)_(monthly|yearly)$/.test(priceKey) || currency.toUpperCase() !== "USD" || !Number.isSafeInteger(cents) || cents < 0) return null;
  return { currency: "USD", value: cents / 100, items: [{ item_id: priceKey, item_name: priceKey.replace("_", " "), price: cents / 100, quantity: 1 }] };
}
