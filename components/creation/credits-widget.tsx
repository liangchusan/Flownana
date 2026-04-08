"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Zap } from "lucide-react";

type Summary = {
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
  pro: "Pro",
  max: "Max",
};

const PLAN_COLOR: Record<string, string> = {
  pro: "bg-blue-50 text-blue-700 border-blue-200",
  max: "bg-violet-50 text-violet-700 border-violet-200",
};

export function CreditsWidget() {
  const { data: session, status } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    fetch("/api/billing/summary")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setSummary(d))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [status]);

  // Not signed in or loading — show nothing
  if (status === "loading" || loading) return null;
  if (!session) return null;

  const plan = summary?.subscription?.planType;
  const credits = summary?.credits?.current ?? 0;
  const hasSub = !!summary?.subscription;

  // ── Subscriber ────────────────────────────────────────────────────────────
  if (hasSub && plan) {
    const planLabel = PLAN_LABEL[plan] ?? plan;
    const planCls = PLAN_COLOR[plan] ?? "bg-slate-100 text-slate-700 border-slate-200";

    return (
      <Link
        href="/account/billing"
        className="flex items-center gap-2 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300"
      >
        {/* Plan badge */}
        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${planCls}`}>
          {planLabel}
        </span>
        {/* Credits */}
        <span className="flex items-center gap-1 text-slate-700 font-medium">
          <Zap className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
          {credits.toLocaleString()}
        </span>
      </Link>
    );
  }

  // ── No subscription — CTA ─────────────────────────────────────────────────
  return (
    <Link
      href="/pricing"
      className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-1.5 text-xs font-medium text-blue-700 shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-300 hover:from-blue-100 hover:to-indigo-100"
    >
      <Zap className="h-3.5 w-3.5 fill-blue-500 text-blue-500" />
      Upgrade to Pro
    </Link>
  );
}
