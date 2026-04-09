"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Skeleton } from "@/components/ui/skeleton";

type Summary = {
  subscription: {
    planType: string;
    billingCycle: string;
    status: string;
    resolution: string;
    creditsPerMonth: number;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
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

  const [isNewCheckout, setIsNewCheckout] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setIsNewCheckout(params.get("checkout") === "success");
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
      <div className="min-h-screen bg-slate-50 px-6 py-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-14 w-full max-w-xs rounded-xl" />
          <Skeleton className="h-10 w-2/3 rounded-lg" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <p className="text-slate-700 mb-4">Sign in to view billing.</p>
        <Link href="/api/auth/signin">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200/60 bg-white px-6 py-4">
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
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Billing</h1>
        <p className="text-slate-600 mb-8">
          Manage subscription and view credits. Credits expire 30 days after
          each grant (FIFO usage).
        </p>

        {/* New subscription success */}
        {isNewCheckout && (
          <div className="mb-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-blue-900 mb-1">
                  🎉 You&apos;re all set!
                </p>
                <p className="text-sm text-blue-700">
                  Your subscription is now active. Credits have been added to your account — start creating right away.
                </p>
              </div>
            </div>
            <Link href="/ai-image" className="mt-4 inline-flex">
              <Button className="rounded-full border-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm hover:from-blue-700 hover:to-blue-800 hover:opacity-90 active:scale-[0.98]">
                Start Creating →
              </Button>
            </Link>
          </div>
        )}

        {/* Upgrade success */}
        {upgradeInfo.success && (
          <div className="mb-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-blue-900 mb-1">
                  ✨ Plan upgraded!
                </p>
                <p className="text-sm text-blue-700">
                  Upgraded to{" "}
                  <span className="font-semibold capitalize">{upgradeInfo.to || "new plan"}</span>.
                  {upgradeInfo.payableCents > 0 && (
                    <> Paid {formatMoney(upgradeInfo.payableCents)}
                    {upgradeInfo.creditCents > 0 ? ` (${formatMoney(upgradeInfo.creditCents)} credit applied)` : ""}.
                    </>
                  )}{" "}
                  New credits have been added to your account.
                </p>
              </div>
            </div>
            <Link href="/ai-image" className="mt-4 inline-flex">
              <Button className="rounded-full border-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm hover:from-blue-700 hover:to-blue-800 hover:opacity-90 active:scale-[0.98]">
                Start Creating →
              </Button>
            </Link>
          </div>
        )}

        {error && (
          <p className="text-red-600 text-sm mb-4">{error}</p>
        )}

        {!summary && !error && (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        )}

        {summary && (
          <div className="space-y-8">
            <section className="bg-white rounded-xl border border-slate-200/60 p-6">
              <h2 className="font-semibold text-slate-900 mb-4">Credits</h2>
              <p className="text-slate-800">
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

            <section className="bg-white rounded-xl border border-slate-200/60 p-6">
              <h2 className="font-semibold text-slate-900 mb-4">Subscription</h2>
              {summary.subscription ? (
                <>
                  <p className="text-slate-800">
                    Plan:{" "}
                    <strong className="capitalize">
                      {summary.subscription.planType}
                    </strong>{" "}
                    ({summary.subscription.billingCycle})
                  </p>
                  <p className="text-slate-600 text-sm mt-1">
                    Output: {summary.subscription.resolution} ·{" "}
                    {summary.subscription.creditsPerMonth} credits / month
                  </p>
                  <p className="text-slate-600 text-sm mt-2">
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
                  <Button className="mt-4" variant="outline" onClick={openPortal}>
                    Manage subscription
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-slate-600 mb-4">No active subscription.</p>
                  <Link href="/pricing">
                    <Button>View plans</Button>
                  </Link>
                </>
              )}
            </section>

            <p className="text-xs text-slate-500">
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
