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
        className="flex items-center space-x-2 transition-all duration-300 hover:opacity-80 active:scale-[0.98]"
      >
        {user.image && (
          <img
            src={user.image}
            alt={user.name || "User"}
            className="h-8 w-8 rounded-full"
          />
        )}
        {user.name && (
          <span className="hidden text-sm text-stone-700 sm:inline">
            {user.name}
          </span>
        )}
        <ChevronDown className="hidden h-4 w-4 text-stone-500 sm:inline" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-stone-200/50 bg-white py-2 shadow-lg">
          <div className="border-b border-stone-200/50 px-4 py-3">
            {user.name && (
              <p className="text-sm font-semibold text-stone-900">{user.name}</p>
            )}
            {user.email && (
              <p className="mt-1 text-sm text-stone-500">{user.email}</p>
            )}
          </div>
          <div className="px-2 py-1 space-y-1">
            <Link
              href="/account/billing"
              className="flex items-center rounded-xl px-3 py-2 text-sm text-stone-700 transition-all duration-300 hover:bg-stone-100"
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
              className="w-full justify-start text-stone-700 hover:bg-stone-100"
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

