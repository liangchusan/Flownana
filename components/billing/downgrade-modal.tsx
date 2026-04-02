"use client";

import { Button } from "@/components/ui/button";

export function DowngradeModal({
  open,
  onClose,
  onManage,
}: {
  open: boolean;
  onClose: () => void;
  onManage: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Downgrade plan</h2>
        <p className="text-sm text-gray-700 mb-4">
          Your downgrade will take effect at the end of your current billing
          period.
        </p>
        <p className="text-sm text-gray-700 mb-6">
          You will continue to enjoy your current plan until then.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onManage}>Manage in Stripe</Button>
        </div>
      </div>
    </div>
  );
}
