"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Loader2 } from "lucide-react";

type Summary = {
  subscription: {
    planType: string;
    billingCycle: string;
    status: string;
    resolution: string;
    creditsPerMonth: number;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    nextPlan: string | null;
  } | null;
  credits: {
    current: number;
    expiringSoon: number;
    expiringInDays: number | null;
  };
};

export default function BillingPage() {
  const { data: session, status } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeInfo, setUpgradeInfo] = useState<{
    success: boolean;
    from: string | null;
    to: string | null;
    creditCents: number;
    payableCents: number;
    currency: string;
    months: number;
  }>({
    success: false,
    from: null,
    to: null,
    creditCents: 0,
    payableCents: 0,
    currency: "USD",
    months: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setUpgradeInfo({
      success: params.get("upgrade") === "success",
      from: params.get("from"),
      to: params.get("to"),
      creditCents: Number(params.get("credit") || "0"),
      payableCents: Number(params.get("payable") || "0"),
      currency: (params.get("currency") || "usd").toUpperCase(),
      months: Number(params.get("months") || "0"),
    });
  }, []);

  const formatMoney = (amountCents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: upgradeInfo.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/billing/summary")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then(setSummary)
      .catch(() => setError("Could not load billing data"));
  }, [status]);

  const openPortal = () => {
    fetch("/api/stripe/portal", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.url) window.location.href = d.url;
        else alert(d.error || "Billing portal unavailable");
      });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <p className="text-gray-700 mb-4">Sign in to view billing.</p>
        <Link href="/api/auth/signin">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo size="sm" />
        </Link>
        <Link href="/pricing">
          <Button variant="outline" size="sm">
            Pricing
          </Button>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing</h1>
        <p className="text-gray-600 mb-8">
          Manage subscription and view credits. Credits expire 30 days after
          each grant (FIFO usage).
        </p>

        {upgradeInfo.success && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">
              Upgrade successful: {upgradeInfo.from || "current"} to {upgradeInfo.to || "new"}.
            </p>
            <p className="text-sm text-blue-800 mt-1">
              Paid {formatMoney(upgradeInfo.payableCents)}
              {upgradeInfo.creditCents > 0
                ? ` after ${formatMoney(upgradeInfo.creditCents)} credit${
                    upgradeInfo.months > 0
                      ? ` (${upgradeInfo.months} remaining month${upgradeInfo.months === 1 ? "" : "s"})`
                      : ""
                  }.`
                : "."}
            </p>
          </div>
        )}

        {error && (
          <p className="text-red-600 text-sm mb-4">{error}</p>
        )}

        {!summary && !error && (
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        )}

        {summary && (
          <div className="space-y-8">
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Credits</h2>
              <p className="text-gray-800">
                Current credits:{" "}
                <strong>{summary.credits.current}</strong>
              </p>
              {summary.credits.expiringInDays !== null &&
                summary.credits.expiringSoon > 0 && (
                  <p className="text-sm text-amber-800 mt-2">
                    Expiring soon: {summary.credits.expiringSoon} (in{" "}
                    {summary.credits.expiringInDays} days)
                  </p>
                )}
              {summary.subscription?.planType === "pro" && (
                <p className="text-sm text-blue-700 mt-4">
                  Upgrade to Max to get 800 credits instantly
                </p>
              )}
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Subscription</h2>
              {summary.subscription ? (
                <>
                  <p className="text-gray-800">
                    Plan:{" "}
                    <strong className="capitalize">
                      {summary.subscription.planType}
                    </strong>{" "}
                    ({summary.subscription.billingCycle})
                  </p>
                  <p className="text-gray-600 text-sm mt-1">
                    Output: {summary.subscription.resolution} ·{" "}
                    {summary.subscription.creditsPerMonth} credits / month
                  </p>
                  <p className="text-gray-600 text-sm mt-2">
                    Renews / period ends:{" "}
                    {new Date(
                      summary.subscription.currentPeriodEnd
                    ).toLocaleDateString()}
                  </p>
                  {summary.subscription.cancelAtPeriodEnd && (
                    <p className="text-amber-700 text-sm mt-2">
                      Cancellation scheduled at period end.
                    </p>
                  )}
                  {summary.subscription.nextPlan && (
                    <p className="text-sm text-gray-600 mt-2">
                      Pending change: {summary.subscription.nextPlan}
                    </p>
                  )}
                  <Button className="mt-4" variant="outline" onClick={openPortal}>
                    Manage subscription
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-gray-600 mb-4">No active subscription.</p>
                  <Link href="/pricing">
                    <Button>View plans</Button>
                  </Link>
                </>
              )}
            </section>

            <p className="text-xs text-gray-500">
              All payments are non-refundable. Yearly plans are prepaid; credits
              are issued each month.{" "}
              <Link href="/pricing" className="text-blue-600 underline">
                See pricing details
              </Link>
              .
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
