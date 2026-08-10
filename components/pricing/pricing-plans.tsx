"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import {
  getPriceKey,
  isLowerTier,
  isPriceKey,
  isUpgradeAllowed,
  PLAN_CATALOG,
  PLAN_KEYS,
  type PlanKey,
  type PriceKey,
} from "@/lib/plans";
import { UpgradeModal } from "@/components/billing/upgrade-modal";
import { useToast } from "@/components/blocks/app-toast-provider";
import { trackEvent } from "@/lib/analytics";
import { signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import { fetchBillingSummary } from "@/lib/billing-summary-client";

const SHARED_FEATURES = [
  "Access to top-quality video models",
  "Image-to-Video generation",
  "Text-to-Video generation",
  "Fast generation mode",
  "Private creation",
  "No watermarks",
];

type BillingMode = "monthly" | "yearly";

const PLANS = PLAN_KEYS.map((planKey) => ({
  planKey,
  ...PLAN_CATALOG[planKey],
  popular: planKey === "pro",
}));

export function PricingPlans({ stripeEnabled }: { stripeEnabled: boolean }) {
  const { data: session, status } = useSession();
  const { showToast } = useToast();
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
  const [upgradeQuoteError, setUpgradeQuoteError] = useState<string | null>(null);
  const [loadingUpgradeQuote, setLoadingUpgradeQuote] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setSummary(null);
      return;
    }
    fetchBillingSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [session]);

  const subscribe = async (pk: PriceKey) => {
    if (!session) {
      trackEvent("signup_started", { source: "pricing", price_key: pk });
      await signInForCurrentEnvironment();
      return;
    }
    if (!stripeEnabled) {
      showToast({
        title: "Checkout unavailable",
        message: "Stripe is not configured. Set STRIPE_PRICE_* in .env.",
        variant: "warning",
      });
      return;
    }
    setLoading(pk);
    trackEvent("checkout_started", {
      price_key: pk,
      checkout_type: "new_subscription",
    });
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
      showToast({
        title: "Checkout failed",
        message: e instanceof Error ? e.message : "Checkout failed",
        variant: "error",
      });
    } finally {
      setLoading(null);
    }
  };

  const upgradeNow = async (pk: PriceKey) => {
    if (!session) {
      trackEvent("signup_started", { source: "pricing_upgrade", price_key: pk });
      await signInForCurrentEnvironment();
      return;
    }
    setLoading(pk);
    trackEvent("checkout_started", {
      price_key: pk,
      checkout_type: "upgrade",
    });
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
      showToast({
        title: "Upgrade failed",
        message: e instanceof Error ? e.message : "Upgrade failed",
        variant: "error",
      });
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
    setUpgradeQuoteError(null);
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
      setUpgradeQuoteError(
        e instanceof Error ? e.message : "Failed to get upgrade quote."
      );
    } finally {
      setLoadingUpgradeQuote(false);
    }
  };

  const ctaForPlan = (plan: PlanKey): {
    label: string;
    disabled: boolean;
    note?: string;
    onClick: () => void;
  } => {
    const pk = getPriceKey(plan, billing);
    const sub = summary?.subscription;
    if (!sub) {
      return {
        label: "Subscribe",
        disabled: false,
        onClick: () => subscribe(pk),
      };
    }

    const currentKeyValue = `${sub.planType}_${sub.billingCycle}`;
    if (!isPriceKey(currentKeyValue)) {
      return {
        label: "Manage plan",
        disabled: false,
        note: "Open billing to manage this subscription.",
        onClick: () => {
          window.location.href = "/account/billing";
        },
      };
    }
    const currentKey = currentKeyValue;
    if (currentKey === pk) {
      return { label: "Current plan", disabled: true, onClick: () => {} };
    }

    if (isUpgradeAllowed(currentKey, pk)) {
      return {
        label: "Upgrade",
        disabled: false,
        onClick: () => openUpgradeModal(pk),
      };
    }

    if (isLowerTier(pk, currentKey)) {
      return {
        label: "Not available",
        disabled: true,
        note: "To downgrade, manage your subscription in the billing portal.",
        onClick: () => {},
      };
    }

    return {
      label: "Not available",
      disabled: true,
      note:
        sub.billingCycle === "yearly" && billing === "monthly"
          ? "Yearly plans can only upgrade to a higher yearly plan."
          : undefined,
      onClick: () => {},
    };
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

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const cta = ctaForPlan(plan.planKey);
          const pk = getPriceKey(plan.planKey, billing);
          const monthlyEquivalent =
            billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice / 12;
          const unitPrice = monthlyEquivalent / plan.credits;
          return (
            <div
              key={plan.planKey}
              className={`relative rounded-2xl border-2 bg-white p-7 transition-all duration-300 ${
                plan.popular
                  ? "border-stone-700 shadow-lg shadow-stone-200/20"
                  : "border-stone-200/50 shadow-sm hover:border-stone-300"
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
                  ${monthlyEquivalent.toFixed(0)}
                </span>
                <span className="text-stone-600">/month</span>
              </div>
              {billing === "yearly" && (
                <p className="mb-4 text-sm text-stone-500">
                  Billed ${plan.yearlyPrice}/year. Credits issued monthly. Unused
                  credits expire after 30 days.
                </p>
              )}
              {billing === "monthly" && (
                <p className="mb-4 text-sm text-stone-500">
                  ${plan.monthlyPrice}/month billed monthly.
                </p>
              )}

              <div className="mb-6 rounded-xl border border-stone-200/50 bg-stone-50 px-4 py-3">
                <p className="text-sm font-semibold text-stone-900">
                  {plan.credits.toLocaleString()} credits / month
                </p>
                <p className="mt-1 text-xs text-stone-600">
                  ${unitPrice.toFixed(2)} per credit · {plan.resolution} output
                </p>
              </div>

              <ul className="mb-8 space-y-2 text-sm">
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
        error={upgradeQuoteError}
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
