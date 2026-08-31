"use client";

import type { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { getAccountScope } from "@/lib/account-scope";
import { Button } from "@/components/ui/button";

/** Never relabel server-rendered private data with the current browser account. */
export function AccountScopeBoundary({ scope, children }: { scope: string | null; children: ReactNode }) {
  const { data: session, status } = useSession();
  if (getAccountScope(session?.user) === scope && (scope || status !== "loading")) return children;
  return <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
    <p className="text-sm text-muted-foreground">{status === "loading" ? "Checking your account…" : "Your account has changed. Refresh to load its details."}</p>
    {status !== "loading" && <Button onClick={() => window.location.reload()}>Refresh account</Button>}
  </main>;
}
