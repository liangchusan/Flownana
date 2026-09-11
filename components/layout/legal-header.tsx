import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export function LegalHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Flownana home" className="rounded-ui transition-all duration-300 hover:opacity-80 active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo size="compact" />
        </Link>
        <Link href="/" className="flex min-h-11 items-center gap-2 rounded-ui px-2 text-sm text-muted-foreground transition-all duration-300 hover:text-foreground active:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>
    </header>
  );
}
