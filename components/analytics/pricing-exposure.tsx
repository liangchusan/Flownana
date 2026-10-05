"use client";
import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
export function PricingExposure({ billing, reported }: { billing: string; reported: { current: boolean } }) {
  const marker = useRef<HTMLSpanElement>(null);
  const cycle = useRef(billing);
  cycle.current = billing;
  useEffect(() => {
    const target = marker.current?.nextElementSibling;
    if (!target) return;
    let visible = false;
    const report = () => {
      if (!reported.current && visible && document.visibilityState === "visible") reported.current = trackEvent("pricing_view", { billing_cycle: cycle.current });
    };
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); report(); }, { threshold: 0.01 });
    observer.observe(target);
    const timer = window.setInterval(report, 500);
    document.addEventListener("visibilitychange", report);
    return () => { observer.disconnect(); window.clearInterval(timer); document.removeEventListener("visibilitychange", report); };
  }, [reported]);
  return <span ref={marker} className="hidden" aria-hidden="true" />;
}
