"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import dynamic from "next/dynamic";
import { PanelLoading } from "@/components/ui/panel-loading";

const PricingPlans = dynamic(() => import("@/components/pricing/pricing-plans").then(m => m.PricingPlans), { loading: PanelLoading });

type PricingModalContextValue = {
  openPricing: () => void;
  closePricing: () => void;
};

const PricingModalContext = createContext<PricingModalContextValue | null>(null);

export function PricingModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const closePricing = useCallback(() => {
    setOpen(false);
    if (window.location.hash === "#pricing") {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
  }, []);
  const openPricing = useCallback(() => {

    setOpen(true);
  }, []);

  useEffect(() => {
    const openFromLink = () => {
      if (window.location.hash === "#pricing") openPricing();
    };
    openFromLink();
    window.addEventListener("hashchange", openFromLink);
    return () => window.removeEventListener("hashchange", openFromLink);
  }, [openPricing]);

  const value = useMemo(
    () => ({ openPricing, closePricing }),
    [closePricing, openPricing]
  );

  return (
    <PricingModalContext.Provider value={value}>
      {children}
      {open && (
        <Modal onClose={closePricing} aria-labelledby="pricing-modal-title"
          className="fixed inset-0 z-[70] overflow-y-auto bg-surface-soft"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget ||
              (event.target instanceof HTMLElement && event.target.dataset.pricingBackdrop === "true")) closePricing();
          }}
        >
          <section
            className="mx-auto min-h-full w-full max-w-7xl px-4 pb-10 pt-16 sm:px-8 sm:pb-14 sm:pt-16"
            data-pricing-backdrop="true"
          >
            <header className="mb-5 text-center">
              <h2
                id="pricing-modal-title"
                className="font-display text-2xl font-medium text-foreground sm:text-3xl"
              >
                Choose your plan
              </h2>
              <button
                type="button"
                onClick={closePricing}
                className="fixed right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-surface-soft text-muted-foreground transition-all duration-300 hover:bg-surface-strong hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-5 sm:top-5"
                aria-label="Close pricing"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div data-pricing-backdrop="true">
              <PricingPlans
                stripeEnabled
                initialBilling="yearly"
              />
            </div>
          </section>
        </Modal>
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
