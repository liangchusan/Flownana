"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyticsChoice, analyticsRevocationPending, configureAnalyticsCollection, hasAnalyticsConsent, reconcileAnalyticsRevocation, setAnalyticsConsent } from "@/lib/analytics";
import type { AnalyticsCollectionPolicy } from "@/lib/analytics-collection-policy";
import { analyticsPromptDismissed, dismissAnalyticsPrompt, PRIVACY_SETTINGS_EVENT, shouldPromptForAnalytics } from "@/lib/analytics-preferences";
import { ADVERTISING_EVENT, advertisingState, allowAdvertising, allowAnonymousAdvertising, reconcileAdvertisingWithdrawal, refreshAdvertisingConsent } from "@/lib/advertising-consent";
import { syncAnalyticsContext } from "@/lib/analytics";
import { useSession } from "next-auth/react";
import { ACCOUNT_SCOPE_HEADER, getAccountScope } from "@/lib/account-scope";

export function AnalyticsPreferences() {
  const { data: session } = useSession();
  const scope = getAccountScope(session?.user);
  const [ads, setAds] = useState({ enabled: false, verified: false, granted: false, pending: false });
  const [savingAds, setSavingAds] = useState(false);
  const [adsError, setAdsError] = useState("");
  const [policy, setPolicy] = useState<AnalyticsCollectionPolicy | null>(null);
  const [open, setOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [pending, setPending] = useState(false);
  const bannerRef = useRef<HTMLElement>(null);
  const choiceVersion = useRef(0);
  useEffect(() => {
    const update = () => setAds(advertisingState());
    update(); window.addEventListener(ADVERTISING_EVENT, update);
    return () => window.removeEventListener(ADVERTISING_EVENT, update);
  }, []);
  useEffect(() => {
    const update = () => {
      setAllowed(hasAnalyticsConsent());
      setPending(analyticsRevocationPending());
      if (analyticsChoice() !== null) setShowBanner(false);
    };
    const openSettings = () => { setShowBanner(false); setOpen(true); setAdsError(""); void refreshAdvertisingConsent(); };
    window.addEventListener(PRIVACY_SETTINGS_EVENT, openSettings);
    window.addEventListener("flownana:analytics-consent", update);
    window.addEventListener("storage", update);
    let active = true;
    const resolvePolicy = async () => {
      let next: AnalyticsCollectionPolicy = { defaultAnalytics: false, gpc: false };
      try {
        const response = await fetch("/api/analytics/policy", { cache: "no-store", signal: AbortSignal.timeout(5000) });
        const value = response.ok ? await response.json() : null;
        if (typeof value?.defaultAnalytics === "boolean" && typeof value?.gpc === "boolean") next = value;
      } catch { /* Unknown region requires a choice. */ }
      next.gpc ||= (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
      if (!active) return;
      configureAnalyticsCollection(next);
      setPolicy(next);
      setShowBanner(shouldPromptForAnalytics(next, analyticsChoice(), analyticsPromptDismissed()));
      update();
    };
    void resolvePolicy();
    return () => {
      active = false;
      window.removeEventListener(PRIVACY_SETTINGS_EVENT, openSettings);
      window.removeEventListener("flownana:analytics-consent", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  useLayoutEffect(() => {
    const banner = bannerRef.current;
    if (!banner) return;
    // Reserve the actual wrapped height, including mobile safe areas, for bottom composers.
    const resize = () => document.documentElement.style.setProperty("--analytics-banner-height", `${banner.getBoundingClientRect().height}px`);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--analytics-banner-height");
    };
  }, [showBanner, open]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      choiceVersion.current++;
      dismissAnalyticsPrompt();
      setShowBanner(false);
      setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  const dismiss = () => { choiceVersion.current++; dismissAnalyticsPrompt(); setShowBanner(false); setOpen(false); };
  const choose = async (granted: boolean) => {
    const version = ++choiceVersion.current;
    setAdsError("");
    setAnalyticsConsent(granted);
    setAllowed(hasAnalyticsConsent());
    setPending(analyticsRevocationPending());
    if (granted && ads.enabled && !scope) allowAnonymousAdvertising();
    if (!granted || !ads.enabled || !scope || !ads.verified) { setSavingAds(false); dismiss(); return; }
    setOpen(true);
    setSavingAds(true); setAdsError("");
    try {
      await syncAnalyticsContext({ [ACCOUNT_SCOPE_HEADER]: scope });
      if (version !== choiceVersion.current) return;
      const grantedAds = hasAnalyticsConsent() && await allowAdvertising();
      if (version !== choiceVersion.current) return;
      if (!grantedAds) {
        setAdsError("Analytics is on. Ad measurement failed; please retry.");
        setOpen(true);
      } else dismiss();
    } catch { if (version === choiceVersion.current) setAdsError("Could not save. Try again when online."); }
    finally { setSavingAds(false); }
  };
  return (showBanner || open) && <section ref={bannerRef} aria-label={open ? "Privacy preferences" : "Analytics privacy choice"} className="fixed inset-x-0 bottom-0 z-40 max-h-[50dvh] overflow-y-auto border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="pr-10 sm:flex-1 sm:pr-0">
          {open && <h2 className="mb-1 text-sm font-semibold">Privacy preferences</h2>}
          <p className="text-sm leading-relaxed text-text-secondary">
          {policy?.defaultAdvertising && ads.enabled && analyticsChoice() === null ? "Analytics and ad measurement are on by default here. Google receives your hashed email with purchases after sign-in to match ads. No personalized ads. Reject anytime." : ads.enabled ? "We use cookies for analytics and ad measurement, and share your hashed email with Google to match purchases to ads. No personalized ads. Withdraw anytime." : "We use Google Analytics to improve Flownana. You can withdraw anytime."}{" "}
          <Link href="/privacy-policy#analytics" onClick={dismiss} className="underline underline-offset-4 transition-all duration-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Privacy policy</Link>
          </p>
          {open && <p className="mt-1 text-sm text-text-secondary">{policy?.gpc ? "Disabled by Global Privacy Control." : pending ? "Analytics off. Withdrawal pending; we'll retry when online." : allowed ? "Analytics on." : "Analytics off."}</p>}
          {open && ads.enabled && <p className="mt-1 text-sm text-text-secondary" role="status">{ads.pending ? "Ad measurement off. Withdrawal pending; sign back in if needed." : ads.granted && allowed ? "Ad measurement on." : !scope ? "Sign in, then Allow to enable ad measurement." : !ads.verified ? "Sign in again, then Allow to enable ad measurement." : "Ad measurement off."}</p>}
          {adsError && <p role="alert" className="mt-1 text-sm text-destructive">{adsError}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" className="min-h-11 flex-1 whitespace-nowrap sm:flex-none" disabled={!policy || policy.gpc || pending || ads.pending || savingAds} onClick={() => { void choose(true); }}>{savingAds ? "Saving…" : "Allow"}</Button>
          <Button variant="outline" className="min-h-11 flex-1 whitespace-nowrap sm:flex-none" onClick={() => { void choose(false); }}>Reject</Button>
          {open && (pending || ads.pending) && <Button variant="ghost" className="min-h-11 basis-full sm:basis-auto" onClick={() => { void reconcileAnalyticsRevocation(); void reconcileAdvertisingWithdrawal(); }}>Retry withdrawal</Button>}
          <Button variant="ghost" size="icon" aria-label={open ? "Close privacy settings" : "Dismiss privacy reminder"} onClick={dismiss} className="absolute right-2 top-2 h-11 w-11 shrink-0 sm:static"><X className="h-4 w-4" /></Button>
        </div>
      </div>
      </div>
    </section>;
}
