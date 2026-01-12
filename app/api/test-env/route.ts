import { NextResponse } from "next/server";

/**
 * 测试环境变量是否正确加载
 * 访问: http://localhost:3000/api/test-env
 */
export async function GET() {
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

  // Test API connectivity
  let apiTest = {
    nanoBanana: "Not tested",
    kie: "Not tested",
  };

  if (process.env.NANO_BANANA_API_KEY) {
    try {
      const testRes = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NANO_BANANA_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/nano-banana",
          input: {
            prompt: "test",
            output_format: "png",
            image_size: "1:1",
          },
        }),
      });
      apiTest.nanoBanana = testRes.ok ? "✅ API accessible" : `❌ API error: ${testRes.status}`;
    } catch (error: any) {
      apiTest.nanoBanana = `❌ Connection failed: ${error.message}`;
    }
  }

  return NextResponse.json({
    message: "Environment Variables Check",
    env,
    apiTest,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  }, { 
    headers: {
      "Content-Type": "application/json",
    }
  });
}


