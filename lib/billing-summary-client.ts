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
const SUMMARY_STORAGE_KEY = "flownana_billing_summary_cache_v1";

let summaryCache: ClientBillingSummary | null = null;
let summaryCacheAt = 0;
let summaryRequest: Promise<ClientBillingSummary | null> | null = null;

function readPersistedSummary(): { summary: ClientBillingSummary | null; cachedAt: number } {
  if (typeof window === "undefined") {
    return { summary: null, cachedAt: 0 };
  }
  try {
    const raw = window.localStorage.getItem(SUMMARY_STORAGE_KEY);
    if (!raw) return { summary: null, cachedAt: 0 };
    const parsed = JSON.parse(raw) as {
      summary?: ClientBillingSummary;
      cachedAt?: number;
    };
    return {
      summary: parsed.summary ?? null,
      cachedAt: parsed.cachedAt ?? 0,
    };
  } catch {
    return { summary: null, cachedAt: 0 };
  }
}

function persistSummary(summary: ClientBillingSummary | null, cachedAt: number) {
  if (typeof window === "undefined") return;
  if (!summary) {
    window.localStorage.removeItem(SUMMARY_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(
    SUMMARY_STORAGE_KEY,
    JSON.stringify({ summary, cachedAt })
  );
}

function isFresh(cachedAt: number) {
  return Date.now() - cachedAt < SUMMARY_CACHE_TTL_MS;
}

export function getCachedBillingSummary(): ClientBillingSummary | null {
  if (summaryCache && isFresh(summaryCacheAt)) return summaryCache;

  const persisted = readPersistedSummary();
  if (persisted.summary && isFresh(persisted.cachedAt)) {
    summaryCache = persisted.summary;
    summaryCacheAt = persisted.cachedAt;
    return persisted.summary;
  }

  return null;
}

export function clearCachedBillingSummary() {
  summaryCache = null;
  summaryCacheAt = 0;
  summaryRequest = null;
  persistSummary(null, 0);
}

export function fetchBillingSummary(): Promise<ClientBillingSummary | null> {
  const cached = getCachedBillingSummary();
  if (cached) return Promise.resolve(cached);

  if (summaryRequest) return summaryRequest;

  summaryRequest = fetch("/api/billing/summary")
    .then((r) => (r.ok ? r.json() : null))
    .then((data: ClientBillingSummary | null) => {
      summaryCache = data;
      summaryCacheAt = Date.now();
      persistSummary(data, summaryCacheAt);
      return data;
    })
    .catch(() => null)
    .finally(() => {
      summaryRequest = null;
    });

  return summaryRequest;
}
