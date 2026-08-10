"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AlertCircle, Zap } from "lucide-react";
import {
  clearCachedBillingSummary,
  fetchBillingSummary,
  getCachedBillingSummary,
  type ClientBillingSummary,
} from "@/lib/billing-summary-client";

type Summary = ClientBillingSummary & {
  subscription: {
    planType: string;
    billingCycle: string;
    status: string;
  } | null;
  credits: {
    current: number;
    expiringSoon: number;
    expiringInDays: number | null;
  };
};

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  max: "Max",
};

const PLAN_COLOR: Record<string, string> = {
  free: "border-stone-200 bg-stone-50 text-stone-700",
  starter: "border-stone-200 bg-stone-100 text-stone-700",
  pro: "border-stone-300 bg-stone-100 text-stone-800",
  max: "border-zinc-300 bg-zinc-100 text-zinc-700",
};

export function CreditsWidget({ variant = "default" }: { variant?: "default" | "sidebar" }) {
  const { data: session, status } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      setSummary(null);
      clearCachedBillingSummary();
      return;
    }
    if (status !== "authenticated") return;

    const cached = getCachedBillingSummary() as Summary | null;
    if (cached) {
      setSummary(cached);
      return;
    }

    if (!summary) {
      setLoading(true);
    }

    fetchBillingSummary()
      .then((d) => {
        setSummary(d as Summary | null);
      })
      .catch(() => {
        if (!getCachedBillingSummary()) {
          setSummary(null);
        }
      })
      .finally(() => setLoading(false));
  }, [status, summary]);

  if ((status === "loading" || loading) && !summary) {
    if (variant === "sidebar") {
      return (
        <div className="h-10 w-10 animate-pulse rounded-xl border border-stone-200/50 bg-stone-100" />
      );
    }
    return (
      <div className="h-8 w-28 animate-pulse rounded-xl border border-stone-200/50 bg-stone-100" />
    );
  }
  if (!session && status !== "loading") return null;

  const plan = summary?.subscription?.planType;
  const credits = summary?.credits?.current ?? 0;
  const hasSub = !!summary?.subscription;
  const isExhausted = credits <= 0;
  const normalizedPlan = hasSub && plan ? plan : "free";
  const planLabel = PLAN_LABEL[normalizedPlan] ?? "Free";
  const sidebarPlanLabel = hasSub ? planLabel : "Upgrade";
  const planCls =
    PLAN_COLOR[normalizedPlan] ?? "border-stone-200 bg-stone-100 text-stone-700";
  const href = hasSub ? "/account/billing" : "/pricing";
  const wrapperCls = isExhausted
    ? "border-amber-300/70 bg-amber-50/80 text-amber-900 hover:border-amber-400/70"
    : "border-stone-200/50 bg-white text-stone-700 hover:border-stone-300";

  if (variant === "sidebar") {
    const displayCredits = isExhausted ? "0" : credits.toLocaleString();
    return (
      <Link
        href={href}
        className={`flex min-h-[68px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border px-0.5 py-1.5 text-[10px] shadow-sm transition-all duration-300 hover:shadow-md ${wrapperCls}`}
        aria-label={`${sidebarPlanLabel} with ${credits} credits`}
        title={`${sidebarPlanLabel} with ${credits.toLocaleString()} credits`}
      >
        <span
          className={`max-w-full rounded-md border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${planCls}`}
        >
          {sidebarPlanLabel}
        </span>
        <span className="flex max-w-full flex-col items-center gap-0.5 font-semibold leading-none">
          {isExhausted ? (
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-700" />
          ) : (
            <Zap className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
          )}
          <span className="max-w-full truncate text-[9px] tabular-nums leading-none tracking-tight">
            {displayCredits}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs shadow-sm transition-all duration-300 hover:shadow-md ${wrapperCls}`}
      aria-label={`${planLabel} plan with ${credits} credits`}
    >
      <span
        className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${planCls}`}
      >
        {planLabel}
      </span>
      {isExhausted ? (
        <span className="flex items-center gap-1 font-medium text-amber-800">
          <AlertCircle className="h-3.5 w-3.5" />
          0 credits
        </span>
      ) : (
        <span className="flex items-center gap-1 font-medium text-stone-700">
          <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          {credits.toLocaleString()}
        </span>
      )}
    </Link>
  );
}
