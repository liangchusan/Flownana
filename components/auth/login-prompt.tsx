"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogIn, Sparkles } from "lucide-react";

export function LoginPrompt() {
  return (
    <div className="bg-white rounded-lg shadow-xl p-8 text-center">
      <div className="flex justify-center mb-6">
        <div className="bg-primary-100 rounded-full p-4">
          <Sparkles className="h-12 w-12 text-primary-500" />
        </div>
      </div>
      
      <h2 className="text-3xl font-bold text-gray-900 mb-4">
        登录以开始使用
      </h2>
      
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        请先登录您的账户以使用 Nano Banana AI 图像生成功能。
        我们支持 Google 账户快速登录。
      </p>
      
      <Button
        onClick={() => signIn("google")}
        size="lg"
        className="flex items-center space-x-2 mx-auto"
      >
        <LogIn className="h-5 w-5" />
        <span>使用 Google 登录</span>
      </Button>
      
      <p className="text-sm text-gray-500 mt-6">
        登录即表示您同意我们的服务条款和隐私政策
      </p>
    </div>
  );
}



