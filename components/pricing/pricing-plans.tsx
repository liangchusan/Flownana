"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Sparkles, ImagePlus, WandSparkles, Film, MessageSquare, LayoutTemplate, Layers, RefreshCw, ShieldCheck } from "lucide-react";
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
import { trackCheckout, syncAnalyticsContext } from "@/lib/analytics";
import { PricingExposure } from "@/components/analytics/pricing-exposure";
import { signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import { fetchBillingSummary } from "@/lib/billing-summary-client";
import { getAccountScope } from "@/lib/account-scope";
import { useAccountOperation } from "@/lib/use-account-operation";
import { isAccountOperationCancelled } from "@/lib/account-operation";
import { clearPricingLoginIntent, readPricingLoginIntent, savePricingLoginIntent } from "@/lib/pricing-login-intent";

const SHARED_FEATURES = [
  { icon: Sparkles, label: "All available image and video models" },
  { icon: ImagePlus, label: "Turn your words into original images" },
  { icon: WandSparkles, label: "Refine images with your own references" },
  { icon: Film, label: "Create videos from text or images" },
  { icon: MessageSquare, label: "Plan and create with your AI Agent" },
  { icon: LayoutTemplate, label: "16 creative templates to get you started" },
  { icon: Layers, label: "Explore up to 4 images per generation" },
  { icon: RefreshCw, label: "Reuse your creations as references" },
  { icon: ShieldCheck, label: "Private creations, watermark-free downloads" },
];

const PLAN_POSITIONING: Record<PlanKey, string> = {
  starter: "Bring your ideas to life",
  pro: "Power your everyday creativity",
  max: "More room for your biggest ideas",
};

const PLANS = PLAN_KEYS.map((planKey) => ({
  planKey,
  ...PLAN_CATALOG[planKey],
  popular: planKey === "pro",
}));

type PricingPlansProps = {
  stripeEnabled: boolean;
  initialBilling?: BillingKey;
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
  const exposureReported = useRef(false);
  return <ScopedPricingPlans exposureReported={exposureReported} key={getAccountScope(session?.user) || "anonymous"} {...props} />;
}

function ScopedPricingPlans({
  stripeEnabled,
  initialBilling = "monthly",
  exposureReported,
}: PricingPlansProps & { exposureReported: { current: boolean } }) {
  const { data: session, status } = useSession();
  const { accountScope, capture } = useAccountOperation();
  const { showToast } = useToast();
  const [billing, setBilling] = useState<BillingKey>(initialBilling);
  const [pendingPlan, setPendingPlan] = useState<PriceKey | null>(null);
  const [summary, setSummary] = useState<{
    subscription: {
      planType: string;
      billingCycle: string;
    } | null;
    paymentIssue: { status: string; plan: string | null } | null;
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
    if (status !== "authenticated") return;
    const pending = readPricingLoginIntent();
    if (!pending) return;
    setBilling(PLAN_DISPLAY[pending].billing);
    setPendingPlan(pending);
  }, [status]);

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

      savePricingLoginIntent(priceKey);
      await signInForCurrentEnvironment(true);
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
    clearPricingLoginIntent();
    setPendingPlan(null);

    try {
      const operation = capture();
      await syncAnalyticsContext(operation.headers);
      operation.assertCurrent();
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...operation.headers },
        signal: operation.signal,
        body: JSON.stringify({ priceKey, returnTo: `${window.location.pathname}${window.location.search}` }),
      });
      const data = await response.json();
      operation.assertCurrent();
      if (!response.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) { trackCheckout(data.checkout || {}); window.location.href = data.url; }
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

      savePricingLoginIntent(priceKey);
      await signInForCurrentEnvironment(true);
      return;
    }

    setLoading(priceKey);

    try {
      const operation = capture();
      await syncAnalyticsContext(operation.headers);
      operation.assertCurrent();
      const response = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...operation.headers },
        signal: operation.signal,
        body: JSON.stringify({ priceKey, returnTo: `${window.location.pathname}${window.location.search}` }),
      });
      const data = await response.json();
      operation.assertCurrent();
      if (!response.ok) throw new Error(data.error || "Upgrade failed");
      if (data.url) {
        trackCheckout(data.checkout || {});
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
    if (summary?.paymentIssue) {
      return {
        label: "Complete payment",
        disabled: false,
        note: "Finish your existing payment in Billing before choosing another plan.",
        onClick: () => { window.location.href = "/account/billing"; },
      };
    }
    const subscription = summary?.subscription;
    if (!subscription) {
      return {
        label: pendingPlan === priceKey ? "Continue with this plan" : "Choose plan",
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
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center rounded-full border border-border bg-surface-soft p-1">
          <button
            type="button"
            onClick={() => { setBilling("monthly"); setPendingPlan(null); clearPricingLoginIntent(); }}
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
            onClick={() => { setBilling("yearly"); setPendingPlan(null); clearPricingLoginIntent(); }}
            className={`flex h-9 items-center rounded-full px-4 text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-5 ${
              billing === "yearly"
                ? "bg-background text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={billing === "yearly"}
          >
            Yearly
            <span className="ml-2 rounded-full bg-brand-blue px-2.5 py-1 text-xs font-semibold text-background">
              Save 50%
            </span>
          </button>
        </div>
      </div>

      <PricingExposure billing={billing} reported={exposureReported} />
      <div data-pricing-backdrop="true" className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
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
              className={`relative flex min-w-0 flex-col rounded-ui-xl border p-6 text-foreground transition-all duration-300 lg:min-h-[49rem] ${
                featured
                  ? "border-brand-blue/30 bg-brand-blue-soft/40"
                  : "border-border bg-background text-foreground hover:border-primary/35"
              }`}
            >
              <div className="flex min-h-10 items-start justify-between gap-3">
                <h3 className="text-2xl font-medium lg:text-3xl">{plan.name}</h3>
                {(isCurrent || featured) && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                      featured
                        ? "bg-brand-blue-soft text-brand-blue"
                        : "bg-surface-soft text-muted-foreground"
                    }`}
                  >
                    {isCurrent ? "Current plan" : "Most popular"}
                  </span>
                )}
              </div>

              <div className="mt-10 flex items-baseline gap-1 lg:mt-16">
                <span className="self-start pt-1 text-lg text-muted-foreground">$</span>
                <span className="font-display text-5xl font-medium leading-none tracking-tight">
                  {monthlyEquivalent.toFixed(0)}
                </span>
                <span className="ml-1 text-xs text-muted-foreground">USD / month</span>
              </div>
              <p className="mt-3 min-h-10 md:min-h-16 lg:min-h-10 text-xs leading-relaxed text-muted-foreground">
                {billing === "yearly"
                  ? `$${plan.yearlyPrice} billed yearly. Credits issued monthly.`
                  : `$${plan.monthlyPrice} billed monthly.`}
              </p>

              <p className="mt-3 text-sm text-muted-foreground">
                {plan.credits.toLocaleString()} credits / month
              </p>
              <p className="mt-7 min-h-12 text-base font-semibold leading-6 lg:mt-8">
                {PLAN_POSITIONING[plan.planKey]}
              </p>

              <Button
                className={`mt-3 h-11 w-full ${featured && !cta.disabled ? "bg-brand-blue text-background hover:bg-brand-blue/90 active:bg-brand-blue/80" : ""}`}
                variant={cta.disabled ? "outline" : "default"}
                disabled={cta.disabled || loading !== null || status === "loading"}
                onClick={cta.onClick}
              >
                {loading === priceKey ? "Opening checkout…" : cta.label}
              </Button>
              {cta.note && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{cta.note}</p>
              )}
              <ul className="mt-7 flex-1 space-y-4 text-sm leading-6 text-text-secondary">
                {SHARED_FEATURES.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-foreground" strokeWidth={1.6} />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

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
