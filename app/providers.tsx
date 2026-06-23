"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { AppToastProvider } from "@/components/blocks/app-toast-provider";

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <AppToastProvider>{children}</AppToastProvider>
    </SessionProvider>
  );
}
