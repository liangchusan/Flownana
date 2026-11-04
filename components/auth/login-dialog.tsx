"use client";

import Image from "next/image";
import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { Loader2, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Logo } from "@/components/ui/logo";
import { useToast } from "@/components/blocks/app-toast-provider";
import { continueSignInForCurrentEnvironment } from "@/lib/auth-sign-in";
import { getAccountScope } from "@/lib/account-scope";
import { beginLoginDialog, closeLoginDialog, failLoginDialog, getLoginDialogState, getServerLoginDialogState, subscribeLoginDialog } from "@/lib/login-dialog-store";

function subscribeDesktop(listener: () => void) {
  const media = window.matchMedia("(min-width: 768px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const isDesktop = () => window.matchMedia("(min-width: 768px)").matches;
const serverDesktop = () => false;

export function LoginDialog() {
  const state = useSyncExternalStore(subscribeLoginDialog, getLoginDialogState, getServerLoginDialogState);
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, serverDesktop);
  const { data: session, status } = useSession();
  const scope = getAccountScope(session?.user);
  const { showToast } = useToast();
  const connecting = state.phase === "connecting";
  useEffect(() => {
    if (state.phase === "open" && status !== "loading" && scope !== state.accountScope) closeLoginDialog();
  }, [scope, status, state.phase, state.accountScope]);
  useEffect(() => {
    // An explicit Pricing choice during preparation can upgrade the existing
    // redirect operation; the redirect helper still deduplicates OAuth.
    if (connecting && state.pricing) void continueSignInForCurrentEnvironment(true).catch(() => {});
  }, [connecting, state.pricing]);

  if (state.phase === "closed") return null;
  const start = async () => {
    if (!beginLoginDialog()) return;
    try {
      const response = await continueSignInForCurrentEnvironment(getLoginDialogState().pricing);
      if (response?.error) throw new Error("sign_in_unavailable");
      // Keep the action latched through the response-to-navigation gap.
    } catch {
      failLoginDialog();
      showToast({ title: "Sign-in unavailable", message: "We couldn’t connect to Google. Please try again.", variant: "error" });
    }
  };

  return <Modal onClose={closeLoginDialog} dismissible={!connecting} aria-labelledby="login-dialog-title" className="bg-foreground/50 p-4">
    <div className="flex min-h-full items-center justify-center" onClick={event => { if (event.target === event.currentTarget) closeLoginDialog(); }}>
      <section className="relative grid w-full max-w-md overflow-hidden rounded-ui-xl bg-background shadow-float md:h-[592px] md:max-w-4xl md:grid-cols-2" aria-busy={connecting}>
        {desktop && <div className="relative hidden overflow-hidden bg-surface-dark md:block" aria-hidden="true">
          <Image src="/brand/login-creative-showcase.png" alt="" fill sizes="448px" className="object-cover" loading="eager" />
        </div>}
        <div className="flex min-h-[420px] flex-col items-center bg-background px-6 pt-14 md:min-h-0 md:px-8 md:pt-20">
          <button type="button" aria-label="Close sign-in" disabled={connecting} onClick={closeLoginDialog} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45">
            <X className="h-5 w-5" />
          </button>
          <Logo size="lg" />
          <div className="flex w-full flex-1 flex-col items-center justify-center gap-9 py-10 md:py-12">
            <h2 id="login-dialog-title" className="text-center text-2xl font-medium leading-tight tracking-tight md:text-3xl">
              <span className="block">Turn your ideas into</span>
              <span className="block">images and videos.</span>
            </h2>
            <button type="button" onClick={() => void start()} disabled={connecting} className="relative flex h-12 w-full max-w-sm items-center justify-center gap-3 rounded-full border border-input bg-background px-6 text-base font-medium text-foreground transition-all duration-300 hover:bg-surface-soft active:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60">
              {connecting ? <Loader2 className="absolute left-5 h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Image src="/brand/google-g.png" alt="" width={20} height={20} className="absolute left-5 h-5 w-5" unoptimized />}
              <span role={connecting ? "status" : undefined}>{connecting ? "Connecting to Google…" : "Continue with Google"}</span>
            </button>
          </div>
          <nav aria-label="Sign-in legal links" className="flex items-center gap-3 pb-8 text-xs text-muted-foreground md:pb-10">
            <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-sm py-2 transition-all duration-300 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Terms of Service</a>
            <span aria-hidden="true">·</span>
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-sm py-2 transition-all duration-300 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Privacy Policy</a>
          </nav>
        </div>
      </section>
    </div>
  </Modal>;
}
