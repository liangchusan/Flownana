"use client";

import { SessionProvider } from "next-auth/react";
import { AppToastProvider } from "@/components/blocks/app-toast-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppToastProvider>{children}</AppToastProvider>
    </SessionProvider>
  );
}


