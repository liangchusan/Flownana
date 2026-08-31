"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/billing/upgrade-modal";
import { useToast } from "@/components/blocks/app-toast-provider";
import {
  getPriceKey,
  isLowerTier,
  isPriceKey,
  isUpgradeAllowed,
  PLAN_CATALOG,
  PLAN_DISPLAY,
  PLAN_KEYS,
  type BillingKey,
  type PlanKey,
  type PriceKey,
} from "@/lib/plans";
import { trackEvent } from "@/lib/analytics";
import { signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import { fetchBillingSummary } from "@/lib/billing-summary-client";
import { getAccountScope } from "@/lib/account-scope";
import { useAccountOperation } from "@/lib/use-account-operation";
import { isAccountOperationCancelled } from "@/lib/account-operation";

const SHARED_FEATURES = [
  "All available image and video models",
  "Private creations with no watermarks",
  "Credits refresh every month",
];

const PLANS = PLAN_KEYS.map((planKey) => ({
  planKey,
  ...PLAN_CATALOG[planKey],
  popular: planKey === "pro",
}));

type PricingPlansProps = {
  stripeEnabled: boolean;
  initialBilling?: BillingKey;
  variant?: "page" | "modal";
};

type UpgradeDetails = {
  currentLabel: string;
  targetLabel: string;
  currentPrice: string;
  targetPrice: string;
  targetCredits: number;
  targetBilling: BillingKey;
} | null;

export function PricingPlans(props: PricingPlansProps) {
  const { data: session } = useSession();
  return <ScopedPricingPlans key={getAccountScope(session?.user) || "anonymous"} {...props} />;
}

function ScopedPricingPlans({
  stripeEnabled,
  initialBilling = "monthly",
  variant = "page",
}: PricingPlansProps) {
  const { data: session, status } = useSession();
  const { accountScope, capture } = useAccountOperation();
  const { showToast } = useToast();
  const [billing, setBilling] = useState<BillingKey>(initialBilling);
  const [summary, setSummary] = useState<{
    subscription: {
      planType: string;
      billingCycle: string;
    } | null;
  } | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeKey, setUpgradeKey] = useState<PriceKey | null>(null);
  const [upgradeDetails, setUpgradeDetails] = useState<UpgradeDetails>(null);
  const [upgradeChargeLine, setUpgradeChargeLine] = useState<string | null>(null);
  const [upgradeQuoteError, setUpgradeQuoteError] = useState<string | null>(null);
  const [loadingUpgradeQuote, setLoadingUpgradeQuote] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [summaryState, setSummaryState] = useState<"loading" | "ready" | "error">("loading");
  const [summaryRetry, setSummaryRetry] = useState(0);
  const quoteRevision = useRef(0);

  useEffect(() => {
    if (!accountScope) {
      setSummary(null);
      return;
    }
    let active = true;
    setSummary(null);
    setSummaryState("loading");
    fetchBillingSummary(accountScope).then((data) => {
      if (active) { setSummary(data); setSummaryState(data ? "ready" : "error"); }
    });
    return () => { active = false; };
  }, [accountScope, summaryRetry]);

  const formatMoney = (amountCents: number, currency: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);

  const subscribe = async (priceKey: PriceKey) => {
    if (loading || status === "loading" || (accountScope && summaryState !== "ready")) return;
    if (!session) {
      trackEvent("signup_started", { source: "pricing", price_key: priceKey });
      await signInForCurrentEnvironment();
      return;
    }
    if (!stripeEnabled) {
      showToast({
        title: "Checkout unavailable",
        message: "Stripe is not configured for this environment.",
        variant: "warning",
      });
      return;
    }

    setLoading(priceKey);
    trackEvent("checkout_started", {
      price_key: priceKey,
      checkout_type: "new_subscription",
    });
    try {
      const operation = capture();
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...operation.headers },
        signal: operation.signal,
        body: JSON.stringify({ priceKey }),
      });
      const data = await response.json();
      operation.assertCurrent();
      if (!response.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) window.location.href = data.url;
    } catch (error) {
      if (isAccountOperationCancelled(error)) return;
      showToast({
        title: "Checkout failed",
        message: error instanceof Error ? error.message : "Checkout failed",
        variant: "error",
      });
    } finally {
      setLoading(null);
    }
  };

  const upgradeNow = async (priceKey: PriceKey) => {
    if (loading || status === "loading" || (accountScope && summaryState !== "ready")) return;
    if (!session) {
      trackEvent("signup_started", {
        source: "pricing_upgrade",
        price_key: priceKey,
      });
      await signInForCurrentEnvironment();
      return;
    }

    setLoading(priceKey);
    trackEvent("checkout_started", {
      price_key: priceKey,
      checkout_type: "upgrade",
    });
    try {
      const operation = capture();
      const response = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...operation.headers },
        signal: operation.signal,
        body: JSON.stringify({ priceKey }),
      });
      const data = await response.json();
      operation.assertCurrent();
      if (!response.ok) throw new Error(data.error || "Upgrade failed");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      window.location.href = "/account/billing?upgrade=success";
    } catch (error) {
      if (isAccountOperationCancelled(error)) return;
      showToast({
        title: "Upgrade failed",
        message: error instanceof Error ? error.message : "Upgrade failed",
        variant: "error",
      });
    } finally {
      setLoading(null);
    }
  };

  const openUpgradeModal = async (priceKey: PriceKey) => {
    const revision = ++quoteRevision.current;
    setUpgradeKey(priceKey);
    setUpgradeOpen(true);
    setUpgradeChargeLine(null);
    setUpgradeQuoteError(null);
    setLoadingUpgradeQuote(true);

    const currentValue = summary?.subscription
      ? `${summary.subscription.planType}_${summary.subscription.billingCycle}`
      : "";
    setUpgradeDetails(
      isPriceKey(currentValue)
        ? {
            currentLabel: PLAN_DISPLAY[currentValue].label,
            targetLabel: PLAN_DISPLAY[priceKey].label,
            currentPrice: `$${
              PLAN_DISPLAY[currentValue].billing === "monthly"
                ? PLAN_CATALOG[PLAN_DISPLAY[currentValue].plan].monthlyPrice
                : PLAN_CATALOG[PLAN_DISPLAY[currentValue].plan].yearlyPrice
            }/${PLAN_DISPLAY[currentValue].billing === "monthly" ? "month" : "year"}`,
            targetPrice: `$${
              PLAN_DISPLAY[priceKey].billing === "monthly"
                ? PLAN_CATALOG[PLAN_DISPLAY[priceKey].plan].monthlyPrice
                : PLAN_CATALOG[PLAN_DISPLAY[priceKey].plan].yearlyPrice
            }/${PLAN_DISPLAY[priceKey].billing === "monthly" ? "month" : "year"}`,
            targetCredits: PLAN_CATALOG[PLAN_DISPLAY[priceKey].plan].credits,
            targetBilling: PLAN_DISPLAY[priceKey].billing,
          }
        : null
    );

    try {
      const operation = capture();
      const response = await fetch(
        `/api/stripe/change-plan/quote?priceKey=${encodeURIComponent(priceKey)}`,
        { headers: operation.headers, signal: operation.signal, cache: "no-store" }
      );
      const data = await response.json();
      operation.assertCurrent();
      if (revision !== quoteRevision.current) return;
      if (!response.ok) {
        throw new Error(data.error || "Failed to get upgrade quote");
      }

      const currency = data.currency || "usd";
      const payable = formatMoney(data.payableAmountCents || 0, currency);
      const credit = Number(data.creditAmountCents || 0);
      const months = Number(data.remainingMonths || 0);
      const targetTotal = formatMoney(data.targetAmountCents || 0, currency);

      if (credit > 0) {
        setUpgradeChargeLine(
          `Due today: ${payable}\n${targetTotal} new plan − ${formatMoney(credit, currency)} credit for ${months} unused month${months === 1 ? "" : "s"}.\nYour new subscription starts immediately.`
        );
      } else {
        setUpgradeChargeLine(
          `Due today: ${payable}\n${targetTotal} for the new billing period.\nYour new subscription starts immediately.`
        );
      }
    } catch (error) {
      if (isAccountOperationCancelled(error) || revision !== quoteRevision.current) return;
      setUpgradeQuoteError(
        error instanceof Error ? error.message : "Failed to get upgrade quote."
      );
    } finally {
      if (revision === quoteRevision.current) setLoadingUpgradeQuote(false);
    }
  };

  const ctaForPlan = (plan: PlanKey) => {
    if (accountScope && summaryState !== "ready") return {
      label: summaryState === "loading" ? "Loading your plan…" : "Retry plan lookup",
      disabled: summaryState === "loading",
      note: summaryState === "error" ? "Your current plan could not be verified." : undefined,
      onClick: () => setSummaryRetry((value) => value + 1),
    };
    const priceKey = getPriceKey(plan, billing);
    const subscription = summary?.subscription;
    if (!subscription) {
      return {
        label: "Choose plan",
        disabled: false,
        onClick: () => subscribe(priceKey),
      };
    }

    const currentValue = `${subscription.planType}_${subscription.billingCycle}`;
    if (!isPriceKey(currentValue)) {
      return {
        label: "Manage plan",
        disabled: false,
        note: "Open billing to manage this subscription.",
        onClick: () => {
          window.location.href = "/account/billing";
        },
      };
    }
    if (currentValue === priceKey) {
      return {
        label: "Current plan",
        disabled: true,
        onClick: () => undefined,
      };
    }
    if (isUpgradeAllowed(currentValue, priceKey)) {
      return {
        label: "Upgrade",
        disabled: false,
        onClick: () => openUpgradeModal(priceKey),
      };
    }
    if (isLowerTier(priceKey, currentValue)) {
      return {
        label: "Not available",
        disabled: true,
        note: "Downgrades are managed in the billing portal.",
        onClick: () => undefined,
      };
    }
    return {
      label: "Not available",
      disabled: true,
      note:
        subscription.billingCycle === "yearly" && billing === "monthly"
          ? "Yearly plans can only move to a higher yearly plan."
          : "This upgrade path is not available.",
      onClick: () => undefined,
    };
  };

  return (
    <>
      <div className={variant === "modal" ? "mb-6 flex justify-center" : "mb-10 flex justify-center"}>
        <div className="inline-flex items-center rounded-full border border-border bg-surface-soft p-1">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={`h-9 rounded-full px-4 text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-5 ${
              billing === "monthly"
                ? "bg-background text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={billing === "monthly"}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling("yearly")}
            className={`flex h-9 items-center rounded-full px-4 text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-5 ${
              billing === "yearly"
                ? "bg-background text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={billing === "yearly"}
          >
            Yearly
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary-active">
              Save 50%
            </span>
          </button>
        </div>
      </div>

      <div
        className={`mx-auto grid grid-cols-1 gap-4 md:grid-cols-3 ${
          variant === "page" ? "max-w-6xl md:gap-6" : "max-w-5xl"
        }`}
      >
        {PLANS.map((plan) => {
          const cta = ctaForPlan(plan.planKey);
          const priceKey = getPriceKey(plan.planKey, billing);
          const monthlyEquivalent =
            billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice / 12;
          const currentValue = summary?.subscription
            ? `${summary.subscription.planType}_${summary.subscription.billingCycle}`
            : null;
          const isCurrent = currentValue === priceKey;
          const featured = plan.popular;

          return (
            <article
              key={plan.planKey}
              className={`relative flex min-w-0 flex-col rounded-ui-xl border p-5 transition-all duration-300 sm:p-6 ${
                featured
                  ? "border-surface-dark bg-surface-dark text-background shadow-float"
                  : "border-border bg-background text-foreground hover:border-primary/35"
              }`}
            >
              <div className="flex min-h-7 items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {(isCurrent || featured) && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                      featured
                        ? "bg-background/10 text-background"
                        : "bg-surface-soft text-muted-foreground"
                    }`}
                  >
                    {isCurrent ? "Current plan" : "Most popular"}
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-end gap-1.5">
                <span className="font-display text-5xl font-medium leading-none">
                  ${monthlyEquivalent.toFixed(0)}
                </span>
                <span className={featured ? "pb-1 text-xs text-background/65" : "pb-1 text-xs text-muted-foreground"}>
                  / month
                </span>
              </div>
              <p className={`mt-2 min-h-10 text-xs leading-relaxed ${featured ? "text-background/65" : "text-muted-foreground"}`}>
                {billing === "yearly"
                  ? `$${plan.yearlyPrice} billed yearly. Credits issued monthly.`
                  : `$${plan.monthlyPrice} billed monthly.`}
              </p>

              <div className={`mt-4 rounded-ui-lg px-4 py-3 ${featured ? "bg-surface-elevated" : "bg-surface-soft"}`}>
                <p className="text-sm font-semibold">
                  {plan.credits.toLocaleString()} credits / month
                </p>
                <p className={`mt-1 text-xs ${featured ? "text-background/60" : "text-muted-foreground"}`}>
                  Up to {plan.resolution} output
                </p>
              </div>

              <ul className={`mt-5 flex-1 space-y-2.5 text-sm ${featured ? "text-background/80" : "text-stone-700"}`}>
                {SHARED_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${featured ? "text-primary" : "text-primary-active"}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className={`mt-6 w-full ${
                  featured && !cta.disabled
                    ? "bg-primary text-white hover:bg-primary-active"
                    : featured
                      ? "border-background/15 bg-background/10 text-background"
                      : ""
                }`}
                variant={featured ? "default" : "outline"}
                disabled={cta.disabled || loading !== null || status === "loading"}
                onClick={cta.onClick}
              >
                {loading === priceKey ? "Opening checkout…" : cta.label}
              </Button>
              <p className={`mt-2 min-h-8 text-center text-[11px] leading-relaxed ${featured ? "text-background/55" : "text-muted-foreground"}`}>
                {cta.note || (billing === "yearly" ? "Yearly commitment" : "Cancel in billing portal")}
              </p>
            </article>
          );
        })}
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
        Credits expire 30 days after each monthly grant. Payments are non-refundable.
      </p>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => { quoteRevision.current += 1; setUpgradeOpen(false); }}
        isLoadingQuote={loadingUpgradeQuote}
        chargeLine={upgradeChargeLine}
        error={upgradeQuoteError}
        currentPlan={upgradeDetails?.currentLabel ?? null}
        targetPlan={upgradeDetails?.targetLabel ?? null}
        currentPrice={upgradeDetails?.currentPrice ?? null}
        targetPrice={upgradeDetails?.targetPrice ?? null}
        targetCredits={upgradeDetails?.targetCredits ?? null}
        targetBilling={upgradeDetails?.targetBilling ?? null}
        onConfirm={() => {
          setUpgradeOpen(false);
          if (upgradeKey) upgradeNow(upgradeKey);
        }}
      />
    </>
  );
}
