"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent, trackPageView } from "@/lib/analytics";

export function AnalyticsEvents() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const trackedSignupCompleted = useRef(false);
  const trackedPurchases = useRef(new Set<string>());

  useEffect(() => {
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    trackPageView(path);

    if (pathname === "/") {
      trackEvent("landing_page_view");
    }
    if (pathname === "/pricing") {
      trackEvent("pricing_viewed");
    }

    const checkoutSuccess = searchParams.get("checkout") === "success";
    const upgradeSuccess = searchParams.get("upgrade") === "success";
    if (pathname === "/account/billing" && (checkoutSuccess || upgradeSuccess)) {
      const key = `${path}:${checkoutSuccess ? "checkout" : "upgrade"}`;
      if (!trackedPurchases.current.has(key)) {
        trackedPurchases.current.add(key);
        trackEvent("purchase_success", {
          purchase_type: checkoutSuccess ? "new_subscription" : "upgrade",
          from: searchParams.get("from"),
          to: searchParams.get("to"),
          payable_cents: Number(searchParams.get("payable") || "0"),
          credit_cents: Number(searchParams.get("credit") || "0"),
          currency: searchParams.get("currency") || "usd",
        });
      }
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    if (status === "authenticated" && !trackedSignupCompleted.current) {
      trackedSignupCompleted.current = true;
      trackEvent("signup_completed");
    }
  }, [status]);

  return null;
}
