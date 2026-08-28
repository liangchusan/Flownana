"use client";

import { ArrowUpRight, Zap } from "lucide-react";
import { usePricingModal } from "@/components/pricing/pricing-modal-provider";

export function CreditsWidget({
  variant = "default",
  compact = false,
}: {
  variant?: "default" | "sidebar";
  compact?: boolean;
}) {
  const { openPricing } = usePricingModal();

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={openPricing}
        className={`flex h-11 w-full items-center rounded-ui border border-primary/25 bg-primary/5 text-sm font-medium text-primary-active transition-all duration-300 hover:border-primary/50 hover:bg-primary/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
          compact ? "justify-center px-0" : "justify-between gap-3 px-3"
        }`}
        aria-label="Upgrade plan"
        title="Upgrade"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Zap className="h-4 w-4 shrink-0" />
          <span className={compact ? "lg:hidden" : ""}>Upgrade</span>
        </span>
        {!compact && <ArrowUpRight className="h-4 w-4 shrink-0 opacity-65" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openPricing}
      className="inline-flex h-10 items-center gap-2 rounded-ui border border-primary/25 bg-primary/5 px-3 text-sm font-medium text-primary-active transition-all duration-300 hover:border-primary/50 hover:bg-primary/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <Zap className="h-4 w-4" />
      Upgrade
    </button>
  );
}
