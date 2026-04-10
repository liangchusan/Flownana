"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import type { PriceKey } from "@/lib/plans";
import { UpgradeModal } from "@/components/billing/upgrade-modal";

const SHARED_FEATURES = [
  "Access to top-quality video models",
  "Image-to-Video generation",
  "Text-to-Video generation",
  "Fast generation mode",
  "Private creation",
  "No watermarks",
];

type BillingMode = "monthly" | "yearly";

const PLANS = [
  {
    name: "Pro",
    planKey: "pro" as const,
    monthly: 16,
    yearly: 96,
    credits: 200,
    resolution: "720P",
  },
  {
    name: "Max",
    planKey: "max" as const,
    monthly: 50,
    yearly: 300,
    credits: 800,
    resolution: "1080P",
    popular: true,
  },
];

function priceKeyFor(
  plan: "pro" | "max",
  billing: BillingMode
): PriceKey {
  if (plan === "pro") {
    return billing === "monthly" ? "pro_monthly" : "pro_yearly";
  }
  return billing === "monthly" ? "max_monthly" : "max_yearly";
}

export function PricingPlans({ stripeEnabled }: { stripeEnabled: boolean }) {
  const { data: session, status } = useSession();
  const [billing, setBilling] = useState<BillingMode>("monthly");
  const [summary, setSummary] = useState<{
    subscription: {
      planType: string;
      billingCycle: string;
    } | null;
  } | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeKey, setUpgradeKey] = useState<PriceKey | null>(null);
  const [upgradeChargeLine, setUpgradeChargeLine] = useState<string | null>(null);
  const [loadingUpgradeQuote, setLoadingUpgradeQuote] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setSummary(null);
      return;
    }
    fetch("/api/billing/summary")
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [session]);

  const subscribe = async (pk: PriceKey) => {
    if (!session) {
      await signIn("google");
      return;
    }
    if (!stripeEnabled) {
      alert("Stripe is not configured. Set STRIPE_PRICE_* in .env.");
      return;
    }
    setLoading(pk);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceKey: pk }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) window.location.href = data.url;
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(null);
    }
  };

  const upgradeNow = async (pk: PriceKey) => {
    if (!session) {
      await signIn("google");
      return;
    }
    setLoading(pk);
    try {
      const res = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceKey: pk }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upgrade failed");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      window.location.href = "/account/billing?upgrade=success";
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Upgrade failed");
    } finally {
      setLoading(null);
    }
  };

  const formatMoney = (amountCents: number, currency: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);

  const openUpgradeModal = async (pk: PriceKey) => {
    setUpgradeKey(pk);
    setUpgradeOpen(true);
    setUpgradeChargeLine(null);
    setLoadingUpgradeQuote(true);
    try {
      const res = await fetch(
        `/api/stripe/change-plan/quote?priceKey=${encodeURIComponent(pk)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get upgrade quote");

      const currency = data.currency || "usd";
      const payable = formatMoney(data.payableAmountCents || 0, currency);
      const credit = Number(data.creditAmountCents || 0);
      const months = Number(data.remainingMonths || 0);
      const newPlanTotal = formatMoney((data.payableAmountCents || 0) + (data.creditAmountCents || 0), currency);

      if (credit > 0) {
        const creditText = formatMoney(credit, currency);
        setUpgradeChargeLine(
          `Today's charge: ${payable}\n${newPlanTotal} (new plan) − ${creditText} credit (${months} unused month${months === 1 ? "" : "s"} remaining on current plan) = ${payable}\nNew subscription starts immediately. Current plan will be canceled.`
        );
      } else {
        setUpgradeChargeLine(
          `Today's charge: ${payable}\nNew subscription starts immediately. Current plan will be canceled.`
        );
      }
    } catch (e: unknown) {
      setUpgradeChargeLine(
        e instanceof Error ? e.message : "Failed to get upgrade quote."
      );
    } finally {
      setLoadingUpgradeQuote(false);
    }
  };

  const allowedUpgrades: Record<PriceKey, PriceKey[]> = {
    pro_monthly: ["pro_yearly", "max_monthly", "max_yearly"],
    pro_yearly: ["max_yearly"],
    max_monthly: ["max_yearly"],
    max_yearly: [],
  };

  const PLAN_RANK: Record<PriceKey, number> = {
    pro_monthly: 1,
    pro_yearly: 2,
    max_monthly: 3,
    max_yearly: 4,
  };

  const ctaForPlan = (plan: "pro" | "max"): {
    label: string;
    disabled: boolean;
    note?: string;
    onClick: () => void;
  } => {
    const pk = priceKeyFor(plan, billing);
    const sub = summary?.subscription;
    if (!sub) {
      return {
        label: "Subscribe",
        disabled: false,
        onClick: () => subscribe(pk),
      };
    }

    const currentKey = `${sub.planType}_${sub.billingCycle}` as PriceKey;
    if (currentKey === pk) {
      return { label: "Current plan", disabled: true, onClick: () => {} };
    }

    if (allowedUpgrades[currentKey]?.includes(pk)) {
      return {
        label: "Upgrade",
        disabled: false,
        onClick: () => openUpgradeModal(pk),
      };
    }

    // Downgrade or lateral — not supported via UI
    if (PLAN_RANK[pk] <= PLAN_RANK[currentKey]) {
      return {
        label: "Not available",
        disabled: true,
        note:
          PLAN_RANK[pk] < PLAN_RANK[currentKey]
            ? "To downgrade, manage your subscription in the billing portal."
            : undefined,
        onClick: () => {},
      };
    }

    return { label: "Not available", disabled: true, onClick: () => {} };
  };

  return (
    <>
      <div className="mb-10 flex justify-center">
        <div className="inline-flex rounded-xl border border-stone-200/50 bg-stone-50 p-1">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={`rounded-lg px-6 py-2 text-sm font-medium transition-all duration-300 ${
              billing === "monthly"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-600"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling("yearly")}
            className={`rounded-lg px-6 py-2 text-sm font-medium transition-all duration-300 ${
              billing === "yearly"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-600"
            }`}
          >
            Yearly{" "}
            <span className="ml-1 text-xs text-stone-700">50% off</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {PLANS.map((plan) => {
          const price = billing === "monthly" ? plan.monthly : plan.yearly / 12;
          const cta = ctaForPlan(plan.planKey);
          const pk = priceKeyFor(plan.planKey, billing);
          return (
            <div
              key={plan.name}
              className={`relative rounded-2xl border-2 p-8 ${
                plan.popular
                  ? "border-stone-700 bg-white shadow-xl"
                  : "border-stone-200/50 bg-white"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-stone-700 px-3 py-1 text-xs font-semibold text-white">
                    Popular
                  </span>
                </div>
              )}
              <h3 className="mb-1 text-2xl font-bold text-stone-900">
                {plan.name}
              </h3>
              <p className="mb-6 text-sm text-stone-600">
                {plan.resolution} output · {plan.credits} credits / month
              </p>
              <div className="mb-2">
                <span className="text-4xl font-bold text-stone-900">
                  ${billing === "monthly" ? plan.monthly : (plan.yearly / 12).toFixed(0)}
                </span>
                <span className="text-stone-600">/month</span>
              </div>
              {billing === "yearly" && (
                <p className="mb-4 text-sm text-stone-500">
                  Billed ${plan.yearly}/year. Credits issued monthly. Unused
                  credits expire after 30 days.
                </p>
              )}
              {billing === "monthly" && (
                <p className="mb-4 text-sm text-stone-500">${plan.monthly}/month billed monthly.</p>
              )}

              <ul className="space-y-2 mb-8 text-sm">
                {SHARED_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-stone-600" />
                    <span className="text-stone-700">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.popular ? "default" : "outline"}
                disabled={cta.disabled || loading === pk || status === "loading"}
                onClick={cta.onClick}
              >
                {loading === pk ? "…" : cta.label}
              </Button>
              {cta.note && (
                <p className="mt-2 text-center text-xs text-stone-500">{cta.note}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-stone-500">
        Credits are issued monthly, not all at once on yearly plans. All payments
        are non-refundable. Upgrading grants new credits immediately; existing
        credits stay valid until they expire.
      </p>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        isLoadingQuote={loadingUpgradeQuote}
        chargeLine={upgradeChargeLine}
        onConfirm={() => {
          setUpgradeOpen(false);
          if (upgradeKey) {
            upgradeNow(upgradeKey);
          }
        }}
      />
    </>
  );
}
