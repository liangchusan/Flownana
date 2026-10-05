"use client";

import type { ComponentPropsWithoutRef } from "react";
import { usePricingModal } from "@/components/pricing/pricing-modal-provider";

export function PricingTrigger({ children, ...props }: Omit<ComponentPropsWithoutRef<"button">, "onClick" | "type">) {
  const { openPricing } = usePricingModal();
  return <button {...props} type="button" onClick={openPricing}>{children}</button>;
}
