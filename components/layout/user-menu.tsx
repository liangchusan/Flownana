"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { LogOut, ChevronDown, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 transition-all duration-200 hover:opacity-80 active:scale-[0.98]"
      >
        {user.image && (
          <img
            src={user.image}
            alt={user.name || "User"}
            className="h-8 w-8 rounded-full"
          />
        )}
        {user.name && (
          <span className="text-sm text-slate-700 hidden sm:inline">
            {user.name}
          </span>
        )}
        <ChevronDown className="h-4 w-4 text-slate-500 hidden sm:inline" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-slate-200/60 bg-white py-2 shadow-lg">
          <div className="px-4 py-3 border-b border-slate-200/60">
            {user.name && (
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
            )}
            {user.email && (
              <p className="text-sm text-slate-500 mt-1">{user.email}</p>
            )}
          </div>
          <div className="px-2 py-1 space-y-1">
            <Link
              href="/account/billing"
              className="flex items-center rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors duration-200 hover:bg-slate-100"
              onClick={() => setIsOpen(false)}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Billing & credits
            </Link>
            <Button
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              variant="ghost"
              className="w-full justify-start text-slate-700 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

