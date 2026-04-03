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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Upgrade to Max</h2>
        <ul className="text-sm text-gray-700 space-y-2 mb-6">
          <li>• Your new plan will take effect immediately</li>
          <li>• You will receive 800 credits instantly</li>
          <li>• Your current credits will remain unchanged</li>
          <li>• Unused credits expire after 30 days</li>
        </ul>
        <p className="text-xs text-gray-500 mb-4">
          Upgrading will immediately grant new credits. Your current credits will
          not be affected.
        </p>
        {isLoadingQuote && (
          <p className="text-xs text-gray-500 mb-4">Calculating charge...</p>
        )}
        {!isLoadingQuote && chargeLine && (
          <p className="text-sm text-blue-700 mb-4">{chargeLine}</p>
        )}
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
