"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { analyticsChoice, analyticsRevocationPending, configureAnalyticsCollection, hasAnalyticsConsent, reconcileAnalyticsRevocation, setAnalyticsConsent } from "@/lib/analytics";
import type { AnalyticsCollectionPolicy } from "@/lib/analytics-collection-policy";

export function AnalyticsPreferences() {
  const [policy, setPolicy] = useState<AnalyticsCollectionPolicy | null>(null);
  const [open, setOpen] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const update = () => { setAllowed(hasAnalyticsConsent()); setPending(analyticsRevocationPending()); };
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
      if (analyticsChoice() === null && !next.defaultAnalytics && !next.gpc) setOpen(true);
      update();
    };
    void resolvePolicy();
    return () => { active = false; window.removeEventListener("flownana:analytics-consent", update); window.removeEventListener("storage", update); };
  }, []);
  const choose = (granted: boolean) => { setAnalyticsConsent(granted); setAllowed(hasAnalyticsConsent()); setPending(analyticsRevocationPending()); setOpen(false); };
  return <>
    <Button variant="outline" size="sm" className="fixed bottom-3 right-3 z-40 bg-background text-xs" onClick={() => setOpen(true)}>Privacy</Button>
    {open && <Modal onClose={() => setOpen(false)} aria-labelledby="analytics-preferences-title" className="flex items-center justify-center bg-background/80 p-4">
      <section className="relative w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-float">
        <Button variant="ghost" size="icon" aria-label="Close privacy settings" onClick={() => setOpen(false)} className="absolute right-3 top-3"><X className="h-4 w-4" /></Button>
        <h2 id="analytics-preferences-title" className="pr-10 text-xl font-semibold">Privacy preferences</h2>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">We use Google Analytics to understand visits, pricing interest, purchases, and successful creations. Ad personalization is off. Your choice does not affect sign-in, payments, or creation.</p>
        <p className="mt-3 text-sm text-text-secondary">{policy?.gpc ? "Your Global Privacy Control signal has turned analytics off." : pending ? "Analytics is off while your withdrawal is being confirmed. We retry automatically when online." : allowed ? "Basic analytics is currently on." : "Basic analytics is currently off."}</p>
        <Link href="/privacy-policy#analytics" onClick={() => setOpen(false)} className="mt-3 inline-block text-sm underline underline-offset-4 transition-all duration-300 hover:text-text-secondary focus-visible:outline focus-visible:outline-2">How we use analytics</Link>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" className="flex-1" disabled={!policy || policy.gpc || pending} onClick={() => choose(true)}>Allow analytics</Button>
          <Button variant="outline" className="flex-1" onClick={() => choose(false)}>Reject analytics</Button>
        </div>
        {pending && <Button variant="ghost" className="mt-3 w-full" onClick={() => { void reconcileAnalyticsRevocation(); }}>Retry withdrawal</Button>}
      </section>
    </Modal>}
  </>;
}
