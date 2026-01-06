"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ImageIcon, LogIn, LogOut, User } from "lucide-react";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-2">
          <ImageIcon className="h-8 w-8 text-primary-500" />
          <span className="text-xl font-bold text-gray-900">Nano Banana</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/" className="text-sm font-medium text-gray-700 hover:text-gray-900">
            首页
          </Link>
          <Link href="/generate" className="text-sm font-medium text-gray-700 hover:text-gray-900">
            生成图像
          </Link>
        </nav>

        <div className="flex items-center space-x-4">
          {session ? (
            <>
              <div className="hidden sm:flex items-center space-x-2">
                {session.user?.image && (
                  <img
                    src={session.user.image}
                    alt={session.user.name || "用户"}
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-700">{session.user?.name}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut()}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">退出</span>
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                // 使用 NextAuth 提供的 signIn 方法，直接触发 Google 登录流程
                signIn("google");
              }}
              className="flex items-center space-x-2"
            >
              <LogIn className="h-4 w-4" />
              <span>登录</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

