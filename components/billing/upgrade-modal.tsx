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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-5 text-xl font-bold text-stone-900">Confirm Upgrade</h2>

        {isLoadingQuote && (
          <p className="mb-5 text-sm text-stone-500">Calculating charge…</p>
        )}

        {!isLoadingQuote && chargeLine && (
          <div className="mb-5 space-y-2 rounded-xl border border-stone-200/50 bg-stone-50 px-4 py-4">
            {/* Prominent amount */}
            <p className="text-lg font-bold text-stone-900">{amountLine}</p>
            {/* Formula */}
            {formulaLine && (
              <p className="text-xs text-stone-500">{formulaLine}</p>
            )}
            {/* Note */}
            {noteLine && (
              <p className="text-xs text-stone-400">{noteLine}</p>
            )}
          </div>
        )}

        <ul className="mb-6 space-y-1.5 text-sm text-stone-600">
          <li className="flex items-start gap-2">
            <span className="shrink-0 text-stone-500">•</span>
            New plan credits granted immediately
          </li>
          <li className="flex items-start gap-2">
            <span className="shrink-0 text-stone-500">•</span>
            Existing credits remain valid until they expire
          </li>
          <li className="flex items-start gap-2">
            <span className="shrink-0 text-stone-500">•</span>
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
