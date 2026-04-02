"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import type { PriceKey } from "@/lib/plans";
import { UpgradeModal } from "@/components/billing/upgrade-modal";
import { DowngradeModal } from "@/components/billing/downgrade-modal";

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
  const [downgradeOpen, setDowngradeOpen] = useState(false);
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
      window.location.href = "/account/billing?upgrade=success";
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Upgrade failed");
    } finally {
      setLoading(null);
    }
  };

  const ctaForPlan = (plan: "pro" | "max") => {
    const pk = priceKeyFor(plan, billing);
    const sub = summary?.subscription;
    if (!sub) {
      return {
        label: "Subscribe",
        disabled: false,
        onClick: () => subscribe(pk),
      };
    }
    const same =
      sub.planType === plan &&
      sub.billingCycle === (billing === "monthly" ? "monthly" : "yearly");
    if (same) {
      return { label: "Current plan", disabled: true, onClick: () => {} };
    }
    if (sub.planType === "pro" && plan === "max") {
      return {
        label: "Upgrade",
        disabled: false,
        onClick: () => setUpgradeOpen(true),
      };
    }
    if (sub.planType === "max" && plan === "pro") {
      return {
        label: "Downgrade",
        disabled: false,
        onClick: () => setDowngradeOpen(true),
      };
    }
    if (sub.planType === plan) {
      return {
        label: billing === "monthly" ? "Switch to yearly (Portal)" : "Switch to monthly (Portal)",
        disabled: false,
        onClick: () => setDowngradeOpen(true),
      };
    }
    return { label: "Subscribe", disabled: false, onClick: () => subscribe(pk) };
  };

  return (
    <>
      <div className="flex justify-center mb-10">
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billing === "monthly"
                ? "bg-white shadow text-gray-900"
                : "text-gray-600"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling("yearly")}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billing === "yearly"
                ? "bg-white shadow text-gray-900"
                : "text-gray-600"
            }`}
          >
            Yearly{" "}
            <span className="text-green-600 text-xs ml-1">50% off</span>
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
                  ? "border-blue-500 shadow-xl bg-white"
                  : "border-gray-200 bg-white"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    Popular
                  </span>
                </div>
              )}
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {plan.name}
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                {plan.resolution} output · {plan.credits} credits / month
              </p>
              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900">
                  ${billing === "monthly" ? plan.monthly : (plan.yearly / 12).toFixed(0)}
                </span>
                <span className="text-gray-600">/month</span>
              </div>
              {billing === "yearly" && (
                <p className="text-sm text-gray-500 mb-4">
                  Billed ${plan.yearly}/year. Credits issued monthly. Unused
                  credits expire after 30 days.
                </p>
              )}
              {billing === "monthly" && (
                <p className="text-sm text-gray-500 mb-4">${plan.monthly}/month billed monthly.</p>
              )}

              <ul className="space-y-2 mb-8 text-sm">
                {SHARED_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <span className="text-gray-700">{f}</span>
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
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-500 mt-10 max-w-2xl mx-auto">
        Credits are issued monthly, not all at once on yearly plans. All payments
        are non-refundable. Upgrading grants new credits immediately; existing
        credits stay valid until they expire.
      </p>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onConfirm={() => {
          setUpgradeOpen(false);
          upgradeNow(priceKeyFor("max", billing));
        }}
      />
      <DowngradeModal
        open={downgradeOpen}
        onClose={() => setDowngradeOpen(false)}
        onManage={() => {
          setDowngradeOpen(false);
          fetch("/api/stripe/portal", { method: "POST" })
            .then((r) => r.json())
            .then((d) => {
              if (d.url) window.location.href = d.url;
              else alert(d.error || "Portal unavailable");
            });
        }}
      />
    </>
  );
}
