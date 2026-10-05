import { analyticsCollectionPolicy } from "@/lib/analytics-collection-policy";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return Response.json(analyticsCollectionPolicy(request.headers), {
    headers: { "Cache-Control": "private, no-store", "Vary": "x-vercel-ip-country, sec-gpc" },
  });
}
