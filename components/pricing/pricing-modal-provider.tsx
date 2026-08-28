"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import { trackEvent } from "@/lib/analytics";

type PricingModalContextValue = {
  openPricing: () => void;
  closePricing: () => void;
};

const PricingModalContext = createContext<PricingModalContextValue | null>(null);

export function PricingModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closePricing = useCallback(() => setOpen(false), []);
  const openPricing = useCallback(() => {
    trackEvent("pricing_viewed", { source: "workspace_upgrade_modal" });
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePricing();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePricing, open]);

  const value = useMemo(
    () => ({ openPricing, closePricing }),
    [closePricing, openPricing]
  );

  return (
    <PricingModalContext.Provider value={value}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/25 backdrop-blur-sm sm:items-center sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePricing();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-modal-title"
            className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background shadow-float sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-6xl sm:rounded-ui-xl sm:border sm:border-border"
          >
            <header className="relative shrink-0 border-b border-border bg-background px-5 py-5 text-center sm:px-8 sm:py-6">
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-primary">
                Plans and credits
              </p>
              <h2
                id="pricing-modal-title"
                className="font-display text-3xl font-medium text-foreground sm:text-display-md"
              >
                Choose your plan
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                Save 50% with yearly billing. Credits are still added every month.
              </p>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closePricing}
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:right-5 sm:top-5"
                aria-label="Close pricing"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7">
              <PricingPlans
                stripeEnabled
                initialBilling="yearly"
                variant="modal"
              />
            </div>
          </section>
        </div>
      )}
    </PricingModalContext.Provider>
  );
}

export function usePricingModal() {
  const context = useContext(PricingModalContext);
  if (!context) {
    throw new Error("usePricingModal must be used within PricingModalProvider");
  }
  return context;
}
