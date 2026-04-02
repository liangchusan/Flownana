"use client";

import { Button } from "@/components/ui/button";

export function UpgradeModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Confirm Upgrade</Button>
        </div>
      </div>
    </div>
  );
}
