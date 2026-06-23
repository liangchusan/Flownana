"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  CreditCard,
  Crown,
  LogOut,
  Mail,
  Pencil,
  User,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchBillingSummary,
  type ClientBillingSummary,
} from "@/lib/billing-summary-client";

type BillingSummary = ClientBillingSummary & {
  subscription: {
    planType: string;
    billingCycle: string;
    status: string;
  } | null;
  credits: {
    current: number;
  };
};

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  align?: "left" | "right";
  compact?: boolean;
}

export function UserMenu({ user, align = "right", compact = false }: UserMenuProps) {
  const { update } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user.name ?? "");
  const [nameDraft, setNameDraft] = useState(user.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisplayName(user.name ?? "");
    setNameDraft(user.name ?? "");
  }, [user.name]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditingName(false);
        setNameError(null);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || summary || summaryLoading) return;

    setSummaryLoading(true);
    fetchBillingSummary()
      .then((data) => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [isOpen, summary, summaryLoading]);

  const planLabel = summary?.subscription
    ? `${summary.subscription.planType.charAt(0).toUpperCase()}${summary.subscription.planType.slice(1)} ${
        summary.subscription.billingCycle
      }`
    : "Free";
  const creditsLabel =
    summary?.credits?.current !== undefined
      ? summary.credits.current.toLocaleString()
      : summaryLoading
        ? "Loading"
        : "0";
  const avatarLabel = displayName || user.email || "User";
  const avatarInitial = avatarLabel.trim().charAt(0).toUpperCase();

  async function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = nameDraft.trim();
    if (!nextName) {
      setNameError("Name is required.");
      return;
    }

    setSavingName(true);
    setNameError(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Could not update name.");
      }
      setDisplayName(data.user.name);
      setNameDraft(data.user.name);
      await update({ name: data.user.name, user: { name: data.user.name } });
      setIsEditingName(false);
    } catch (error) {
      setNameError(error instanceof Error ? error.message : "Could not update name.");
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center transition-all duration-300 hover:opacity-80 active:scale-[0.98] ${
          compact ? "justify-center" : "space-x-2"
        }`}
        aria-label="Open account menu"
      >
        {user.image && !compact ? (
          <img
            src={user.image}
            alt={avatarLabel}
            className="h-8 w-8 rounded-full"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-800 text-xs font-semibold text-white">
            {avatarInitial}
          </span>
        )}
        {displayName && !compact && (
          <span className="hidden text-sm text-stone-700 sm:inline">
            {displayName}
          </span>
        )}
        {!compact && <ChevronDown className="hidden h-4 w-4 text-stone-500 sm:inline" />}
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 w-72 rounded-xl border border-stone-200/50 bg-white py-2 shadow-lg shadow-stone-200/20 ${
            align === "left"
              ? "bottom-0 left-[calc(100%+0.75rem)]"
              : "right-0 top-full mt-2"
          }`}
        >
          <div className="border-b border-stone-200/50 px-4 py-3">
            {isEditingName ? (
              <form onSubmit={handleNameSubmit} className="space-y-2">
                <label className="text-xs font-medium text-stone-500" htmlFor="account-name">
                  User name
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="account-name"
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    maxLength={80}
                    className="min-w-0 flex-1 rounded-xl border border-stone-200/70 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none transition-all duration-300 focus:border-stone-400 focus:bg-white"
                    disabled={savingName}
                  />
                  <button
                    type="submit"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-800 text-white transition-all duration-300 hover:bg-stone-700 active:scale-[0.98] disabled:opacity-60"
                    disabled={savingName}
                    aria-label="Save user name"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-200/70 text-stone-600 transition-all duration-300 hover:bg-stone-100 active:scale-[0.98]"
                    onClick={() => {
                      setNameDraft(displayName);
                      setIsEditingName(false);
                      setNameError(null);
                    }}
                    disabled={savingName}
                    aria-label="Cancel editing user name"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {nameError && <p className="text-xs text-red-600">{nameError}</p>}
              </form>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">
                    {displayName || "Unnamed user"}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">User name</p>
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-stone-500 transition-all duration-300 hover:bg-stone-100 hover:text-stone-900 active:scale-[0.98]"
                  onClick={() => setIsEditingName(true)}
                  aria-label="Edit user name"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2 border-b border-stone-200/50 px-4 py-3">
            <div className="flex items-center gap-3 text-sm text-stone-700">
              <Mail className="h-4 w-4 shrink-0 text-stone-500" />
              <span className="min-w-0 truncate">{user.email || "No email connected"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-stone-700">
              <Crown className="h-4 w-4 shrink-0 text-stone-500" />
              <span className="min-w-0 truncate">{planLabel}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-stone-700">
              <Zap className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
              <span className="min-w-0 truncate">{creditsLabel} credits left</span>
            </div>
          </div>

          <div className="space-y-1 px-2 py-1">
            <Link
              href="/account/billing"
              className="flex items-center rounded-xl px-3 py-2 text-sm text-stone-700 transition-all duration-300 hover:bg-stone-100"
              onClick={() => setIsOpen(false)}
            >
              <User className="mr-2 h-4 w-4 text-stone-500" />
              Account details
            </Link>
            <Link
              href="/account/billing"
              className="flex items-center rounded-xl px-3 py-2 text-sm text-stone-700 transition-all duration-300 hover:bg-stone-100"
              onClick={() => setIsOpen(false)}
            >
              <CreditCard className="mr-2 h-4 w-4 text-stone-500" />
              Manage subscription
            </Link>
            <Button
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              variant="ghost"
              className="w-full justify-start text-stone-700 hover:bg-stone-100"
            >
              <LogOut className="mr-2 h-4 w-4 text-stone-500" />
              Sign Out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
