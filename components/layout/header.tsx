"use client";

import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { UserMenu } from "@/components/layout/user-menu";

interface HeaderProps {
  showBackground?: boolean;
}

export function Header({ showBackground = false }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 group ${
        showBackground
          ? "bg-black/70"
          : "bg-transparent hover:bg-black/70"
      }`}
    >
      <div className="container flex h-16 items-center px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Logo - Left */}
        <Link href="/" className="flex-shrink-0">
          <Logo size="md" textColor="text-white" />
        </Link>

        {/* Navigation - Left aligned after logo */}
        <nav className="hidden md:flex items-center space-x-8 ml-8">
          <Link 
            href="/ai-video" 
            className="text-sm font-medium text-white hover:text-white/80 transition-colors"
          >
            AI Video
          </Link>
          <Link 
            href="/ai-image" 
            className="text-sm font-medium text-white hover:text-white/80 transition-colors"
          >
            AI Image
          </Link>
          <Link 
            href="/ai-music" 
            className="text-sm font-medium text-white hover:text-white/80 transition-colors"
          >
            AI Music
          </Link>
          <Link 
            href="/pricing" 
            className="text-sm font-medium text-white hover:text-white/80 transition-colors"
          >
            Pricing
          </Link>
        </nav>

        {/* User Menu / Login Button - Right */}
        <div className="flex items-center ml-auto">
          {session ? (
            <UserMenu
              user={{
                name: session.user?.name,
                email: session.user?.email,
                image: session.user?.image,
              }}
            />
          ) : (
            <Button
              onClick={() => signIn("google")}
              className="flex items-center space-x-2 transition-all bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Start Free Now</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

