import { NextResponse } from "next/server";

/**
 * 测试环境变量是否正确加载
 * 访问: http://localhost:3000/api/test-env
 */
export async function GET() {
  const env = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "❌ 未设置",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "✅ 已设置" : "❌ 未设置",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID 
      ? `✅ 已设置 (${process.env.GOOGLE_CLIENT_ID.substring(0, 30)}...)` 
      : "❌ 未设置",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET 
      ? "✅ 已设置" 
      : "❌ 未设置",
    NANO_BANANA_API_KEY: process.env.NANO_BANANA_API_KEY 
      ? "✅ 已设置" 
      : "❌ 未设置",
  };

  return NextResponse.json({
    message: "环境变量检查",
    env,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  }, { 
    headers: {
      "Content-Type": "application/json",
    }
  });
}


