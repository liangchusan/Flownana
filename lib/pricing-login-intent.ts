import { isPriceKey, type PriceKey } from "@/lib/plans";

const KEY = "flownana_pricing_login_intent_v1";
const MAX_AGE_MS = 10 * 60 * 1000;

export function savePricingLoginIntent(priceKey: PriceKey) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ priceKey, createdAt: Date.now() }));
  } catch { /* Sign-in must still work when storage is unavailable. */ }
}

export function readPricingLoginIntent(): PriceKey | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (data && typeof data === "object" &&
      "priceKey" in data && "createdAt" in data &&
      typeof data.priceKey === "string" && isPriceKey(data.priceKey) &&
      typeof data.createdAt === "number" &&
      data.createdAt <= Date.now() && Date.now() - data.createdAt < MAX_AGE_MS) return data.priceKey;
  } catch { /* Invalid storage is equivalent to no selection. */ }
  clearPricingLoginIntent();
  return null;
}

export function clearPricingLoginIntent() {
  try { window.sessionStorage.removeItem(KEY); } catch { /* Optional state. */ }
}
