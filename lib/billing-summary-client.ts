import { accountRequestHeaders } from "@/lib/account-scope";

export type ClientBillingSummary = {
  subscription: {
    planType: string;
    billingCycle: string;
    status: string;
    resolution?: string;
    creditsPerMonth?: number;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
  } | null;
  credits: {
    current: number;
    expiringSoon?: number;
    expiringInDays?: number | null;
  };
};

const SUMMARY_CACHE_TTL_MS = 60_000;
const SUMMARY_STORAGE_KEY = "flownana_billing_summary_cache_v2";
const SUMMARY_INVALIDATION_KEY = "flownana_billing_summary_invalidated";
const cache = new Map<string, { summary: ClientBillingSummary; cachedAt: number }>();
const requests = new Map<string, Promise<ClientBillingSummary | null>>();
let revision = 0;
let listening = false;
let allowPersistedReads = true;

function invalidateMemory() {
  revision++;
  allowPersistedReads = false;
  cache.clear();
  requests.clear();
}

function watchInvalidation() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === SUMMARY_INVALIDATION_KEY || event.key === "nextauth.message" ||
      (event.key === SUMMARY_STORAGE_KEY && event.newValue === null)) invalidateMemory();
  });
}

function isFresh(cachedAt: unknown): cachedAt is number {
  return typeof cachedAt === "number" && Number.isFinite(cachedAt) &&
    Date.now() >= cachedAt && Date.now() - cachedAt < SUMMARY_CACHE_TTL_MS;
}

function isSummary(value: unknown): value is ClientBillingSummary {
  if (!value || typeof value !== "object") return false;
  const data = value as ClientBillingSummary;
  return !!data.credits && Number.isFinite(data.credits.current) && data.credits.current >= 0 &&
    (data.subscription === null || (!!data.subscription && typeof data.subscription.planType === "string" &&
      typeof data.subscription.billingCycle === "string" && typeof data.subscription.status === "string"));
}

export function getCachedBillingSummary(scope: string | null): ClientBillingSummary | null {
  if (!scope) return null;
  watchInvalidation();
  const entry = cache.get(scope);
  if (entry && isFresh(entry.cachedAt)) return entry.summary;
  if (!allowPersistedReads || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SUMMARY_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved.scope !== scope || saved.summary?.accountScope !== scope || !isFresh(saved.cachedAt) || !isSummary(saved.summary)) return null;
    cache.set(scope, { summary: saved.summary, cachedAt: saved.cachedAt });
    return saved.summary;
  } catch {
    return null;
  }
}

export function clearCachedBillingSummary() {
  invalidateMemory();
  if (typeof window === "undefined") return;
  // Storage is an optional optimization; it must never prevent signOut.
  try {
    window.localStorage.removeItem(SUMMARY_STORAGE_KEY);
    window.localStorage.removeItem("flownana_billing_summary_cache_v1");
    window.localStorage.setItem(SUMMARY_INVALIDATION_KEY, `${Date.now()}:${Math.random()}`);
  } catch {}
}

export function fetchBillingSummary(scope: string | null): Promise<ClientBillingSummary | null> {
  if (!scope) return Promise.resolve(null);
  const cached = getCachedBillingSummary(scope);
  if (cached) return Promise.resolve(cached);
  const existing = requests.get(scope);
  if (existing) return existing;
  const startedRevision = revision;
  const request = fetch("/api/billing/summary", { cache: "no-store", headers: accountRequestHeaders(scope) })
    .then((response) => response.ok ? response.json() : null)
    .then((data: unknown) => {
      if (revision !== startedRevision || !isSummary(data) ||
        (data as ClientBillingSummary & { accountScope?: string }).accountScope !== scope) return null;
      const cachedAt = Date.now();
      if (cache.size >= 4) cache.delete(cache.keys().next().value!);
      cache.set(scope, { summary: data, cachedAt });
      try {
        if (typeof window !== "undefined") window.localStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify({ scope, summary: data, cachedAt }));
      } catch {}
      return data;
    })
    .catch(() => null)
    .finally(() => {
      if (requests.get(scope) === request) requests.delete(scope);
    });
  requests.set(scope, request);
  return request;
}
