"use client";

import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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
    <Modal onClose={onClose} aria-labelledby="upgrade-dialog-title" className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-surface-soft/95 px-4 py-16 backdrop-blur-sm">
        <button
          type="button"
          onClick={onClose}
          className="fixed right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-surface-soft text-muted-foreground transition-all duration-300 hover:bg-surface-strong hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-5 sm:top-5"
          aria-label="Close upgrade confirmation"
        >
          <X className="h-5 w-5" />
        </button>
      <section
        className="w-full max-w-xl max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-ui-xl border border-border bg-background p-6 sm:p-8"
      >


        <h2 id="upgrade-dialog-title" className="text-center text-2xl font-medium text-foreground sm:text-3xl">
          Upgrade your plan
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
          A little more room to create. Review your upgrade below.
        </p>

        {currentPlan && targetPlan && (
          <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-ui-xl border border-border bg-surface-soft/50 p-4 sm:p-5">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Current</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {currentPlan}
              </p>
              {currentPrice && (
                <p className="mt-0.5 text-xs text-muted-foreground">{currentPrice}</p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 text-right">
              <p className="text-xs text-muted-foreground">New plan</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
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
          <div role="status" aria-label="Calculating upgrade price" className="mt-4 animate-pulse rounded-ui-xl bg-surface-soft p-5">
            <div className="h-5 w-40 rounded bg-surface-strong" />
            <div className="mt-3 h-3 w-full rounded bg-surface-strong" />
          </div>
        )}

        {!isLoadingQuote && chargeLine && (
          <div className="mt-4 rounded-ui-xl border border-brand-blue/25 bg-brand-blue-soft/40 p-5">
            <p className="text-2xl font-medium tracking-tight text-foreground" aria-live="polite">{amountLine}</p>
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
          <p role="alert" className="mt-4 rounded-ui-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
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

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
          <Button className="h-11 sm:flex-1" variant="outline" onClick={onClose}>
            Back to plans
          </Button>
          <Button
            className="h-11 bg-brand-blue text-background hover:bg-brand-blue/90 active:bg-brand-blue/80 sm:flex-[2]"
            onClick={onConfirm}
            disabled={!!isLoadingQuote || !!error || !chargeLine}
          >
            Continue to checkout
          </Button>
        </div>
      </section>
    </Modal>
  );
}
