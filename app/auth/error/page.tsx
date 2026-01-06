"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

const errorMessages: Record<string, string> = {
  Configuration: "服务器配置错误，请联系管理员",
  AccessDenied: "访问被拒绝",
  Verification: "验证失败，请重试",
  OAuthSignin: "OAuth 登录初始化失败。请检查：1) .env 文件中的 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET 是否正确 2) Google Cloud Console 中的重定向 URI 是否包含 http://localhost:3000/api/auth/callback/google",
  OAuthCallback: "OAuth 回调处理失败",
  OAuthCreateAccount: "无法创建 OAuth 账户",
  EmailCreateAccount: "无法创建邮箱账户",
  Callback: "回调处理失败",
  OAuthAccountNotLinked: "该邮箱已关联其他账户",
  EmailSignin: "发送验证邮件失败",
  CredentialsSignin: "用户名或密码错误",
  SessionRequired: "需要登录才能访问",
  Default: "发生未知错误，请重试",
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Default";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-red-100 rounded-full p-3">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-4">
          登录失败
        </h1>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800 whitespace-pre-line">
            {errorMessages[error] || errorMessages.Default}
          </p>
        </div>

        {error === "OAuthSignin" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm font-semibold text-blue-900 mb-2">排查步骤：</p>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>检查终端控制台是否有 "NextAuth 配置检查" 的输出</li>
              <li>确认 .env 文件在项目根目录且内容正确</li>
              <li>确认 Google Cloud Console 中已添加重定向 URI：<code className="bg-blue-100 px-1 rounded">http://localhost:3000/api/auth/callback/google</code></li>
              <li>重启开发服务器（npm run dev）</li>
            </ol>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link href="/">
            <Button className="w-full">返回首页</Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            重试登录
          </Button>
        </div>
      </div>
    </div>
  );
}

