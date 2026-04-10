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
  pro: "border-stone-300 bg-stone-100 text-stone-700",
  max: "border-zinc-300 bg-zinc-100 text-zinc-700",
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
    const planCls = PLAN_COLOR[plan] ?? "border-stone-200 bg-stone-100 text-stone-700";

    return (
      <Link
        href="/account/billing"
        className="flex items-center gap-2 rounded-xl border border-stone-200/50 bg-white px-3 py-1.5 text-xs shadow-sm transition-all duration-300 hover:border-stone-300 hover:shadow-md"
      >
        {/* Plan badge */}
        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${planCls}`}>
          {planLabel}
        </span>
        {/* Credits */}
        <span className="flex items-center gap-1 font-medium text-stone-700">
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
      className="flex items-center gap-1.5 rounded-xl border border-stone-200/50 bg-gradient-to-r from-stone-50 to-zinc-50 px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition-all duration-300 hover:border-stone-300 hover:shadow-md hover:from-stone-100 hover:to-zinc-100"
    >
      <Zap className="h-3.5 w-3.5 fill-stone-600 text-stone-600" />
      Upgrade to Pro
    </Link>
  );
}
