"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { getAccountScope } from "@/lib/account-scope";
import { CreditCard, LogOut, UserRound } from "lucide-react";
import {
  clearCachedBillingSummary,
  fetchBillingSummary,
  getCachedBillingSummary,
  type ClientBillingSummary,
} from "@/lib/billing-summary-client";

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  align?: "left" | "right";
  compact?: boolean;
  variant?: "default" | "sidebar";
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  max: "Max",
};

function AccountAvatar({
  image,
  label,
  size = "sm",
}: {
  image?: string | null;
  label: string;
  size?: "sm" | "lg";
}) {
  const dimension = size === "lg" ? 44 : 32;
  const className = size === "lg" ? "h-11 w-11 text-sm" : "h-8 w-8 text-xs";
  const initial = label.trim().charAt(0).toUpperCase() || "U";

  if (image) {
    return (
      <span className={`relative block shrink-0 overflow-hidden rounded-full bg-surface-strong ${className}`}>
        <Image
          src={image}
          alt={label}
          fill
          sizes={`${dimension}px`}
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-surface-dark font-semibold text-background ${className}`}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

export function UserMenu({
  align = "right",
  compact = false,
  variant = "default",
}: UserMenuProps) {
  const { data: session } = useSession();
  const accountScope = getAccountScope(session?.user);
  if (!accountScope) return null;
  return <ScopedUserMenu key={accountScope} user={session!.user!} align={align} compact={compact} variant={variant} accountScope={accountScope} />;
}

function ScopedUserMenu({ user, align, compact, variant, accountScope }: UserMenuProps & { accountScope: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<ClientBillingSummary | null>(() =>
    getCachedBillingSummary(accountScope)
  );
  const [summaryLoading, setSummaryLoading] = useState(!summary);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let active = true;
    setSummaryLoading(!getCachedBillingSummary(accountScope));
    fetchBillingSummary(accountScope)
      .then((data) => {
        if (active) setSummary(data);
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accountScope, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        !desktopMenuRef.current?.contains(target) &&
        !mobileMenuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const displayName = user.name?.trim() || "Account";
  const planLabel = summary?.subscription?.planType
    ? PLAN_LABELS[summary.subscription.planType] || "Member"
    : summary ? "Free" : "Plan unavailable";
  const creditsLabel = summaryLoading
    ? "Loading credits"
    : summary ? `${summary.credits.current.toLocaleString()} credits` : "Credits unavailable";

  const menuContents = (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <AccountAvatar image={user.image} label={displayName} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {displayName}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {user.email || "No email connected"}
          </p>
        </div>
      </div>

      <div className="space-y-1 p-2">
        <Link
          href="/account/profile"
          role="menuitem"
          className="flex min-h-10 items-center rounded-ui px-3 text-sm text-foreground transition-all duration-300 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={() => setIsOpen(false)}
        >
          <UserRound className="mr-3 h-4 w-4 text-muted-foreground" />
          Account Profile
        </Link>
        <Link
          href="/account/billing"
          role="menuitem"
          className="flex min-h-10 items-center rounded-ui px-3 text-sm text-foreground transition-all duration-300 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={() => setIsOpen(false)}
        >
          <CreditCard className="mr-3 h-4 w-4 text-muted-foreground" />
          Plans and Billing
        </Link>
        <button
          type="button"
          role="menuitem"
          className="flex min-h-10 w-full items-center rounded-ui px-3 text-sm text-destructive transition-all duration-300 hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={async () => {
            setIsOpen(false);
            clearCachedBillingSummary();
            await signOut({ callbackUrl: "/" });
          }}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div
      className={`relative ${variant === "sidebar" ? "w-full" : ""}`}
      ref={menuRef}
    >
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex items-center text-left transition-all duration-300 hover:bg-background active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
          compact ? "justify-center" : "gap-2.5"
        } ${
          variant === "sidebar"
            ? `min-h-12 w-full rounded-ui ${compact ? "px-0" : "px-2 py-1.5"}`
            : "rounded-ui px-2 py-1.5"
        }`}
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <AccountAvatar image={user.image} label={displayName} />
        {!compact && variant === "sidebar" && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {displayName}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {planLabel} · {creditsLabel}
            </span>
          </span>
        )}
        {!compact && variant === "default" && (
          <span className="hidden max-w-40 truncate text-sm font-medium text-foreground sm:block">
            {displayName}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={desktopMenuRef}
          role="menu"
          aria-label="Account menu"
          className={`absolute z-[60] hidden w-72 overflow-hidden rounded-ui-lg border border-border bg-popover shadow-float lg:block ${
            align === "left"
              ? "bottom-0 left-[calc(100%+0.75rem)]"
              : "right-0 top-full mt-2"
          }`}
        >
          {menuContents}
        </div>
      )}
      {isOpen &&
        mounted &&
        createPortal(
          <div
            ref={mobileMenuRef}
            role="menu"
            aria-label="Account menu"
            className="fixed inset-x-3 bottom-3 z-[80] overflow-hidden rounded-ui-lg border border-border bg-popover shadow-float lg:hidden"
          >
            {menuContents}
          </div>,
          document.body
        )}
    </div>
  );
}
