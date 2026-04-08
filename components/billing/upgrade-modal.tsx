"use client";

import { Button } from "@/components/ui/button";

export function UpgradeModal({
  open,
  onClose,
  onConfirm,
  isLoadingQuote,
  chargeLine,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoadingQuote?: boolean;
  chargeLine?: string | null;
}) {
  if (!open) return null;

  // chargeLine format: "Today's charge: $X\nformula line\nnote line"
  const [amountLine, formulaLine, noteLine] = (chargeLine ?? "").split("\n");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-5">Confirm Upgrade</h2>

        {isLoadingQuote && (
          <p className="text-sm text-slate-500 mb-5">Calculating charge…</p>
        )}

        {!isLoadingQuote && chargeLine && (
          <div className="rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-4 mb-5 space-y-2">
            {/* Prominent amount */}
            <p className="text-lg font-bold text-slate-900">{amountLine}</p>
            {/* Formula */}
            {formulaLine && (
              <p className="text-xs text-slate-500">{formulaLine}</p>
            )}
            {/* Note */}
            {noteLine && (
              <p className="text-xs text-slate-400">{noteLine}</p>
            )}
          </div>
        )}

        <ul className="text-sm text-slate-600 space-y-1.5 mb-6">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 shrink-0">•</span>
            New plan credits granted immediately
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 shrink-0">•</span>
            Existing credits remain valid until they expire
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 shrink-0">•</span>
            Unused credits expire after 30 days
          </li>
        </ul>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!!isLoadingQuote}>
            Confirm Upgrade
          </Button>
        </div>
      </div>
    </div>
  );
}
