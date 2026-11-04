import type { NextRequest } from "next/server";
import { authHandler } from "@/lib/auth-options";
import { ANALYTICS_BLOCK_COOKIE } from "@/lib/analytics-policy";

export const GET = authHandler;
export async function POST(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const url = new URL(request.url);
  const googleLogin = url.pathname === "/api/auth/signin/google" && request.headers.get("origin") === url.origin;
  // Handoff also works if browser-side preference writes failed. This is a denial,
  // never a grant, and survives a failed/offline context DELETE through OAuth.
  const ready = googleLogin && (await request.clone().formData().catch(() => null))?.get("analyticsReady") === "1";
  const response = await authHandler(request, context);
  if (googleLogin && !ready) response.headers.append("set-cookie", `${ANALYTICS_BLOCK_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=${180 * 86400}${url.protocol === "https:" ? "; Secure" : ""}`);
  return response;
}
