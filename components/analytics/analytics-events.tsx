"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { captureAnalyticsContext, GA_ENABLED, GA_MEASUREMENT_ID, hasAnalyticsConsent, reconcileAnalyticsRevocation, setTagDisabled, trackPageView } from "@/lib/analytics";
import { allowedAnalyticsHost, safePage, TEST_GA_ID } from "@/lib/analytics-policy";
import { ACCOUNT_SCOPE_HEADER, getAccountScope } from "@/lib/account-scope";

export function AnalyticsEvents({ measurementAllowed }: { measurementAllowed: boolean }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const scope = getAccountScope(session?.user);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const lastPage = useRef<string | null>(null);
  useEffect(() => {
    const retryWithdrawal = () => { void reconcileAnalyticsRevocation(); };
    retryWithdrawal();
    window.addEventListener("online", retryWithdrawal);
    const timer = window.setInterval(retryWithdrawal, 60_000);
    return () => { window.removeEventListener("online", retryWithdrawal); window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    const update = () => {
      const allowed = measurementAllowed && GA_ENABLED && !!GA_MEASUREMENT_ID &&
        allowedAnalyticsHost(GA_MEASUREMENT_ID, window.location.hostname) && hasAnalyticsConsent();
      setTagDisabled(!allowed);
      setEnabled(allowed);
      if (!allowed) {
        lastPage.current = null;
        window.gtag?.("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
        return;
      }
      if (window.gtag) {
        window.gtag("consent", "update", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
        return;
      }
      window.dataLayer = window.dataLayer || [];
      // gtag.js consumes the official arguments object; plain arrays are ignored.
      window.gtag = function () { window.dataLayer!.push(arguments); };
      window.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      window.gtag("js", new Date());
      window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false, allow_google_signals: false,
        allow_ad_personalization_signals: false, ...safePage(window.location.href, window.location.origin, document.referrer),
        ...(GA_MEASUREMENT_ID === TEST_GA_ID ? { debug_mode: true } : {}) });
    };
    update();
    window.addEventListener("flownana:analytics-consent", update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener("flownana:analytics-consent", update); window.removeEventListener("storage", update); };
  }, [measurementAllowed]);
  useEffect(() => {
    if (!enabled || !ready || lastPage.current === pathname) return;
    window.gtag?.("config", GA_MEASUREMENT_ID, { send_page_view: false, ...safePage(window.location.href, window.location.origin, document.referrer) });
    if (trackPageView(window.location.href)) lastPage.current = pathname;
  }, [pathname, ready, enabled]);
  useEffect(() => {
    if (!enabled || !ready) return;
    const abort = new AbortController();
    const sync = async () => {
      const context = await captureAnalyticsContext();
      if (context && !abort.signal.aborted && hasAnalyticsConsent()) await fetch("/api/analytics/context", {
        method: "POST", headers: { "Content-Type": "application/json", ...(scope ? { [ACCOUNT_SCOPE_HEADER]: scope } : {}) },
        body: JSON.stringify(context), signal: abort.signal,
      }).catch(() => undefined);
    };
    void sync();
    const timer = window.setInterval(() => { void sync(); }, 60_000);
    return () => { abort.abort(); window.clearInterval(timer); };
  }, [scope, enabled, ready]);
  return enabled && GA_MEASUREMENT_ID ? <Script id="flownana-google-tag" src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" onReady={() => setReady(true)} /> : null;
}
