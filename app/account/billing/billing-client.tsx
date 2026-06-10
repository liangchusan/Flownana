"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { useToast } from "@/components/blocks/app-toast-provider";
import { signInForCurrentEnvironment } from "@/lib/auth-sign-in";

export type BillingSummary = {
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

export type UpgradeInfo = {
  success: boolean;
  from: string | null;
  to: string | null;
  creditCents: number;
  payableCents: number;
  currency: string;
  months: number;
};

type BillingClientProps = {
  signedIn: boolean;
  summary: BillingSummary | null;
  error?: string | null;
  isNewCheckout: boolean;
  upgradeInfo: UpgradeInfo;
};

export function BillingClient({
  signedIn,
  summary,
  error,
  isNewCheckout,
  upgradeInfo,
}: BillingClientProps) {
  const { showToast } = useToast();

  const formatMoney = (amountCents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: upgradeInfo.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);

  const openPortal = () => {
    fetch("/api/stripe/portal", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.url) window.location.href = d.url;
        else {
          showToast({
            title: "Billing portal unavailable",
            message: d.error || "Billing portal unavailable",
            variant: "error",
          });
        }
      });
  };

  if (!signedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <p className="mb-4 text-stone-700">Sign in to view billing.</p>
        <Button onClick={() => signInForCurrentEnvironment()}>Sign in</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDF9]">
      <header className="flex items-center justify-between border-b border-stone-200/50 bg-[#FDFDF9] px-6 py-4">
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
        <h1 className="mb-2 text-3xl font-bold text-stone-900">Billing</h1>
        <p className="mb-8 text-stone-600">
          Manage subscription and view credits. Credits expire 30 days after
          each grant (FIFO usage).
        </p>

        {/* New subscription success */}
        {isNewCheckout && (
          <div className="mb-6 rounded-2xl border border-stone-200/50 bg-gradient-to-br from-stone-50 to-zinc-50 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-lg font-bold text-stone-900">
                  🎉 You&apos;re all set!
                </p>
                <p className="text-sm text-stone-700">
                  Your subscription is now active. Credits have been added to your account — start creating right away.
                </p>
              </div>
            </div>
            <Link href="/ai-image" className="mt-4 inline-flex">
              <Button className="rounded-xl border-0 bg-stone-800 text-white shadow-sm transition-all duration-300 hover:bg-stone-800/90 active:scale-[0.98]">
                Start Creating →
              </Button>
            </Link>
          </div>
        )}

        {/* Upgrade success */}
        {upgradeInfo.success && (
          <div className="mb-6 rounded-2xl border border-stone-200/50 bg-gradient-to-br from-stone-50 to-zinc-50 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-lg font-bold text-stone-900">
                  ✨ Plan upgraded!
                </p>
                <p className="text-sm text-stone-700">
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
              <Button className="rounded-xl border-0 bg-stone-800 text-white shadow-sm transition-all duration-300 hover:bg-stone-800/90 active:scale-[0.98]">
                Start Creating →
              </Button>
            </Link>
          </div>
        )}

        {error && (
          <p className="text-red-600 text-sm mb-4">{error}</p>
        )}

        {summary && (
          <div className="space-y-8">
            <section className="rounded-xl border border-stone-200/50 bg-white p-6">
              <h2 className="mb-4 font-semibold text-stone-900">Credits</h2>
              <p className="text-stone-800">
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
                <p className="mt-4 text-sm text-stone-700">
                  Upgrade to Max to get 800 credits instantly
                </p>
              )}
            </section>

            <section className="rounded-xl border border-stone-200/50 bg-white p-6">
              <h2 className="mb-4 font-semibold text-stone-900">Subscription</h2>
              {summary.subscription ? (
                <>
                  <p className="text-stone-800">
                    Plan:{" "}
                    <strong className="capitalize">
                      {summary.subscription.planType}
                    </strong>{" "}
                    ({summary.subscription.billingCycle})
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    Output: {summary.subscription.resolution} ·{" "}
                    {summary.subscription.creditsPerMonth} credits / month
                  </p>
                  <p className="mt-2 text-sm text-stone-600">
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
                  <p className="mb-4 text-stone-600">No active subscription.</p>
                  <Link href="/pricing">
                    <Button>View plans</Button>
                  </Link>
                </>
              )}
            </section>

            <p className="text-xs text-stone-500">
              All payments are non-refundable. Yearly plans are prepaid; credits
              are issued each month.{" "}
              <Link href="/pricing" className="text-stone-700 underline">
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
