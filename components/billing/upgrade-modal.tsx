"use client";

import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BillingKey } from "@/lib/plans";

export function UpgradeModal({
  open,
  onClose,
  onConfirm,
  isLoadingQuote,
  chargeLine,
  error,
  currentPlan,
  targetPlan,
  currentPrice,
  targetPrice,
  targetCredits,
  targetBilling,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoadingQuote?: boolean;
  chargeLine?: string | null;
  error?: string | null;
  currentPlan?: string | null;
  targetPlan?: string | null;
  currentPrice?: string | null;
  targetPrice?: string | null;
  targetCredits?: number | null;
  targetBilling?: BillingKey | null;
}) {
  if (!open) return null;

  const [amountLine, formulaLine, noteLine] = (chargeLine ?? "").split("\n");

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/30 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-dialog-title"
        className="relative w-full rounded-t-ui-xl border border-border bg-background p-5 shadow-float sm:max-w-lg sm:rounded-ui-xl sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label="Close upgrade confirmation"
        >
          <X className="h-5 w-5" />
        </button>

        <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-primary">
          Confirm change
        </p>
        <h2 id="upgrade-dialog-title" className="pr-10 text-xl font-medium text-foreground">
          Upgrade your plan
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Review the plan, billing period, credits, and amount before continuing.
        </p>

        {currentPlan && targetPlan && (
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-ui-lg bg-surface-soft p-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Current</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">
                {currentPlan}
              </p>
              {currentPrice && (
                <p className="mt-0.5 text-xs text-muted-foreground">{currentPrice}</p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 text-right">
              <p className="text-xs text-muted-foreground">New plan</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">
                {targetPlan}
              </p>
              {targetPrice && (
                <p className="mt-0.5 text-xs text-muted-foreground">{targetPrice}</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-ui-lg border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Credits</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {targetCredits?.toLocaleString() ?? "—"} / month
            </p>
          </div>
          <div className="rounded-ui-lg border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Billing</p>
            <p className="mt-1 text-sm font-semibold capitalize text-foreground">
              {targetBilling ?? "—"}
            </p>
          </div>
        </div>

        {isLoadingQuote && (
          <div className="mt-4 animate-pulse rounded-ui-lg bg-surface-soft p-4">
            <div className="h-5 w-40 rounded bg-surface-strong" />
            <div className="mt-3 h-3 w-full rounded bg-surface-strong" />
          </div>
        )}

        {!isLoadingQuote && chargeLine && (
          <div className="mt-4 rounded-ui-lg border border-primary/20 bg-primary/5 px-4 py-4">
            <p className="text-base font-semibold text-foreground">{amountLine}</p>
            {formulaLine && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {formulaLine}
              </p>
            )}
            {noteLine && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {noteLine}
              </p>
            )}
          </div>
        )}

        {!isLoadingQuote && error && (
          <p className="mt-4 rounded-ui-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-2 text-xs text-muted-foreground">
          <p className="flex items-start gap-2">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-active" />
            New plan credits are granted after payment completes.
          </p>
          <p className="flex items-start gap-2">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-active" />
            Existing credits remain available until their original expiry.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!!isLoadingQuote || !!error || !chargeLine}
          >
            Continue to checkout
          </Button>
        </div>
      </section>
    </div>
  );
}
