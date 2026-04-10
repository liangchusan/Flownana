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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold text-stone-900">Manage plan in Stripe</h2>
        <p className="mb-4 text-sm text-stone-700">
          Downgrades and billing-cycle switches are managed in Stripe Billing
          Portal.
        </p>
        <p className="mb-6 text-sm text-stone-700">
          Changes to a lower price typically take effect at the end of your
          current billing period.
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
