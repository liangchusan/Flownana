"use client";

import type { Session } from "next-auth";

export function SessionBoundary({
  children,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  // The root Providers owns the only NextAuth SessionProvider. NextAuth v4
  // shares a global refresh callback, so nested providers can disagree forever.
  // Private server seeds carry their own explicit account scope at the caller.
  return children;
}
