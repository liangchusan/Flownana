import { ACCOUNT_SCOPE_HEADER } from "./account-scope";
const RECEIPTS = "flownana_advertising_receipts";
const PENDING = "flownana_advertising_withdrawals";
const INTENT = "flownana_advertising_intent";
const INTENT_VERSION = "2026-10-12-v1";
function anonymousIntent(): { version: string; grantedAt: number; account: string | null } | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(INTENT) || "null");
    return value?.version === INTENT_VERSION && Number.isFinite(value.grantedAt) && value.grantedAt <= Date.now() && Date.now() - value.grantedAt < 180 * 86400_000 && (value.account === null || typeof value.account === "string") ? value : null;
  } catch { return null; }
}
export function allowAnonymousAdvertising() {
  if (scope || !enabled || Object.keys(withdrawals()).length) return false;
  try {
    window.localStorage.setItem(INTENT, JSON.stringify({ version: INTENT_VERSION, grantedAt: Date.now(), account: null }));
    window.localStorage.removeItem(OPT_OUT); announce(); return true;
  } catch { return false; }
}
const OPT_OUT = "flownana_advertising_opt_out";
export const ADVERTISING_EVENT = "flownana:advertising-consent";
let scope: string | null = null;
let grantedScope: string | null = null;
let enabled = false;
let verified = false;
let regionalDefault = false;
let serverDefaultAllowed = false;
function optedOut() {
  try { return window.localStorage.getItem(OPT_OUT) === "denied" || window.localStorage.getItem("flownana_analytics_consent") === "denied"; }
  catch { return true; }
}
export function configureAdvertisingDefault(permitted: boolean) {
  if (regionalDefault === permitted) return;
  regionalDefault = permitted; announce();
}
let revision = 0;
let memoryPending: Record<string, string> = {};
let grantingScope: string | null = null;
const read = (key: string): Record<string, string> => {
  try { const data = JSON.parse(window.localStorage.getItem(key) || "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value === "string")) as Record<string, string> : {};
  } catch { return {}; }
};
const withdrawals = () => ({ ...read(PENDING), ...memoryPending });
const announce = () => window.dispatchEvent(new Event(ADVERTISING_EVENT));
export function advertisingState() {
  const pending = Object.keys(withdrawals()).length > 0;
  return { enabled, verified, granted: !pending && (scope ? grantedScope === scope : (regionalDefault || anonymousIntent()?.account === null) && !optedOut()), pending };
}
export function hasAdvertisingConsent() { return advertisingState().granted && enabled; }
export function bindAdvertisingAccount(nextScope: string | null) {
  if (scope === nextScope) return;
  scope = nextScope; grantedScope = null; verified = false; serverDefaultAllowed = false; revision++; announce();
}
export async function refreshAdvertisingConsent() {
  const current = scope, version = revision;
  if (!current) { enabled = process.env.NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED === "true"; announce(); return; }
  try {
    const response = await fetch("/api/analytics/advertising", { headers: { [ACCOUNT_SCOPE_HEADER]: current }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    const data = response.ok ? await response.json() : null;
    if (scope !== current || version !== revision) return;
    enabled = data?.enabled === true; verified = data?.verified === true;
    serverDefaultAllowed = data?.defaultAllowed === true;
    grantedScope = null;
    if (enabled && verified && data.granted && typeof data.receipt === "string" && !withdrawals()[current]) {
      const receipts = read(RECEIPTS); receipts[current] = data.receipt;
      window.localStorage.setItem(RECEIPTS, JSON.stringify(receipts)); grantedScope = current;
    }
  } catch { if (scope === current && version === revision) grantedScope = null; } // Offline never restores a grant.
  announce();
}
export async function allowAdvertising(basis: "explicit" | "regional_default" = "explicit") {
  const current = scope, version = revision;
  if (!current || !enabled || !verified || Object.keys(withdrawals()).length) return false;
  if (basis === "regional_default" && (!regionalDefault || !serverDefaultAllowed || optedOut())) return false;
  // Verify durable storage before initiating a server-side grant.
  window.localStorage.setItem(RECEIPTS, JSON.stringify(read(RECEIPTS)));
  const intent = withdrawals(); intent[current] = "account";
  window.localStorage.setItem(PENDING, JSON.stringify(intent));
  let data: { granted?: boolean; receipt?: string } | null = null;
  grantingScope = current;
  try {
    const response = await fetch("/api/analytics/advertising", { method: "POST", headers: { "Content-Type": "application/json", [ACCOUNT_SCOPE_HEADER]: current },
      body: JSON.stringify({ storage: true, userData: true, basis }), signal: AbortSignal.timeout(5000) });
    data = response.ok ? await response.json() : null;
  } catch { grantingScope = null; void reconcileAdvertisingWithdrawal(); return false; }
  grantingScope = null;
  if (!data?.granted || typeof data.receipt !== "string") { void reconcileAdvertisingWithdrawal(); return false; }
  const receipts = read(RECEIPTS); receipts[current] = data.receipt;
  // Retain withdrawal authority even if the user changed accounts during the request.
  try { window.localStorage.setItem(RECEIPTS, JSON.stringify(receipts)); }
  catch { memoryPending[current] = data.receipt; void reconcileAdvertisingWithdrawal(); return false; }
  if (scope !== current || revision !== version) { revokeAdvertising(); return false; }
  const pending = read(PENDING); delete pending[current];
  window.localStorage.setItem(PENDING, JSON.stringify(pending));
  if (basis === "explicit") window.localStorage.removeItem(OPT_OUT);
  grantedScope = current; announce(); return true;
}
let ensuringDefault: Promise<void> | null = null;
export function ensureDefaultAdvertising(): Promise<void> {
  if (ensuringDefault) return ensuringDefault;
  ensuringDefault = (async () => {
    const current = scope;
    if (!current || optedOut() || Object.keys(withdrawals()).length) return;
    const intent = anonymousIntent();
    const eligibleIntent = !!intent && (intent.account === null || intent.account === current);
    if (!regionalDefault && !eligibleIntent) return;
    await refreshAdvertisingConsent();
    if (scope !== current || optedOut() || !verified || Object.keys(withdrawals()).length) return;
    if (eligibleIntent) {
      // Claim before the request; timeout, reload, or account switches cannot reuse it.
      const latest = anonymousIntent();
      if (!latest || (latest.account !== null && latest.account !== current)) return;
      window.localStorage.setItem(INTENT, JSON.stringify({ ...latest, account: current }));
      if (!hasAdvertisingConsent()) await allowAdvertising("explicit");
    } else if (!hasAdvertisingConsent() && serverDefaultAllowed) await allowAdvertising("regional_default");
  })().finally(() => { ensuringDefault = null; });
  return ensuringDefault;
}
export function revokeAdvertising() {
  revision++; grantedScope = null;
  try { window.localStorage.setItem(OPT_OUT, "denied"); window.localStorage.removeItem(INTENT); } catch { regionalDefault = false; }
  const receipts = read(RECEIPTS), pending = { ...withdrawals(), ...receipts };
  if (scope && !pending[scope]) pending[scope] = "account";
  memoryPending = pending;
  try { window.localStorage.setItem(PENDING, JSON.stringify(pending)); } catch { /* Collection stays disabled in memory. */ }
  window.gtag?.("consent", "update", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  announce(); void reconcileAdvertisingWithdrawal();
}
let withdrawal: Promise<void> | null = null;
export function reconcileAdvertisingWithdrawal(): Promise<void> {
  if (withdrawal) return withdrawal;
  withdrawal = (async () => {
    for (const [account, receipt] of Object.entries(withdrawals())) {
      if (grantingScope === account) continue;
      try {
        const response = await fetch("/api/analytics/advertising", { method: "DELETE", headers: { "Content-Type": "application/json", [ACCOUNT_SCOPE_HEADER]: account },
          body: JSON.stringify({ receipt: receipt === "account" ? undefined : receipt }), keepalive: true, signal: AbortSignal.timeout(15_000) });
        if (!response.ok) continue;
        const pending = read(PENDING), receipts = read(RECEIPTS);
        if (pending[account] === receipt) delete pending[account];
        if (receipts[account] === receipt) delete receipts[account];
        window.localStorage.setItem(PENDING, JSON.stringify(pending));
        window.localStorage.setItem(RECEIPTS, JSON.stringify(receipts));
        if (memoryPending[account] === receipt) delete memoryPending[account];
      } catch { /* Durable receipt permits retry after refresh/logout. */ }
    }
    announce();
  })().finally(() => { withdrawal = null; });
  return withdrawal;
}
