import { NextResponse } from "next/server";

/**
 * 测试环境变量是否正确加载
 * 访问: http://localhost:3000/api/test-env
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const env = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "❌ Not set",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "✅ Set" : "❌ Not set",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID 
      ? `✅ Set (${process.env.GOOGLE_CLIENT_ID.substring(0, 30)}...)` 
      : "❌ Not set",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET 
      ? "✅ Set" 
      : "❌ Not set",
    NANO_BANANA_API_KEY: process.env.NANO_BANANA_API_KEY 
      ? "✅ Set" 
      : "❌ Not set",
    KIE_API_KEY: process.env.KIE_API_KEY 
      ? "✅ Set" 
      : process.env.NANO_BANANA_API_KEY 
        ? "✅ Using NANO_BANANA_API_KEY as fallback" 
        : "❌ Not set",
  };

  return NextResponse.json({
    message: "Environment Variables Check",
    env,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  }, { 
    headers: {
      "Content-Type": "application/json",
    }
  });
}

