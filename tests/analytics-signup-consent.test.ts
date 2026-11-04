import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";
import { ANALYTICS_BLOCK_COOKIE, ANALYTICS_COOKIE, TEST_GA_ID } from "../lib/analytics-policy.ts";

test("Google callback rechecks current refusal, GPC and region before queuing a new registration", async t => {
  const keys = ["NODE_ENV", "VERCEL_ENV", "NEXT_PUBLIC_GA_ENABLED", "NEXT_PUBLIC_GA_MEASUREMENT_ID", "NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GA_API_SECRET"];
  const prior = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { NODE_ENV: "production", VERCEL_ENV: "preview", NEXT_PUBLIC_GA_ENABLED: "true", NEXT_PUBLIC_GA_MEASUREMENT_ID: TEST_GA_ID, NEXTAUTH_SECRET: "fixture-only-not-a-real-secret", GOOGLE_CLIENT_ID: "fixture", GOOGLE_CLIENT_SECRET: "GOCSPX-fixture" });
  delete process.env.GA_API_SECRET;
  t.after(() => { for (const key of keys) prior[key] === undefined ? delete process.env[key] : process.env[key] = prior[key]; });
  const jar = new Map<string, string>(); let requestHeaders = new Headers();
  const rows: any[] = [];
  let server: typeof import("../lib/analytics-server");
  const load = createSourceLoader({
    "@/lib/prisma": { prisma: {} }, "next/server": { after() {} },
    "next-auth": { __esModule: true, default: () => null },
    "next/headers": { cookies: async () => ({ get: (key: string) => jar.has(key) ? { value: jar.get(key) } : undefined }), headers: async () => requestHeaders },
    "@/lib/user-sync": { upsertAppUser: async (input: any) => {
      const createdAt = new Date();
      await server.queueAnalyticsReport({ analyticsReport: { createMany: async ({ data }: any) => { rows.push(data); return { count: 1 }; } } } as any,
        { userId: input.id, key: input.id, name: "sign_up", params: { method: "google" }, context: input.analyticsContext, occurredAt: createdAt });
      return { createdAt };
    } },
  });
  server = load<typeof import("../lib/analytics-server")>("lib/analytics-server.ts");
  const auth = load<typeof import("../lib/auth-options")>("lib/auth-options.ts");
  const cases = [
    { country: "US", basis: "regional_default", blocked: false, gpc: false, expected: "pending" },
    { country: "TW", basis: "regional_default", blocked: false, gpc: false, expected: "pending" },
    { country: "DE", basis: "regional_default", blocked: false, gpc: false, expected: "missing_context" },
    { country: "", basis: "regional_default", blocked: false, gpc: false, expected: "missing_context" },
    { country: "US", basis: "regional_default", blocked: true, gpc: false, expected: "missing_context" },
    { country: "US", basis: "regional_default", blocked: false, gpc: true, expected: "missing_context" },
    { country: "DE", basis: "explicit", blocked: false, gpc: false, expected: "pending" },
    { country: "DE", basis: "explicit", blocked: true, gpc: false, expected: "missing_context" },
    { country: "DE", basis: "explicit", blocked: false, gpc: true, expected: "missing_context" },
  ] as const;
  for (const [index, c] of cases.entries()) {
    jar.clear(); requestHeaders = new Headers({ "x-vercel-ip-country": c.country, "sec-gpc": c.gpc ? "1" : "0" });
    const signed = server.signAnalyticsContext({ clientId: "123.456", sessionId: 1793000000, capturedAt: Date.now(), measurementId: TEST_GA_ID, collectionBasis: c.basis });
    jar.set(ANALYTICS_COOKIE, signed!); if (c.blocked) jar.set(ANALYTICS_BLOCK_COOKIE, "1");
    assert.equal(await auth.authOptions.callbacks!.signIn!({ user: { id: `fixture-${index}`, email: "fixture@example.test" }, account: { provider: "google" }, profile: { email_verified: true } } as any), true);
    assert.equal(rows.at(-1).status, c.expected, JSON.stringify(c));
    assert.equal(Boolean(rows.at(-1).context), c.expected === "pending");
    requestHeaders.set("cookie", `${ANALYTICS_COOKIE}=${signed};${c.blocked ? `${ANALYTICS_BLOCK_COOKIE}=1` : ""}`);
    const request = new Request("http://localhost/api/fixture", { headers: requestHeaders });
    assert.equal(Boolean(server.contextFromRequest(request)), c.expected === "pending");
    assert.ok(server.contextFromRequest(request, true), "withdrawal still reads the token under denial/GPC");
  }
});

test("OAuth initiation records denial even when browser preference writes or context DELETE failed", async () => {
  let forwardedBody: FormData | null = null;
  const route = createSourceLoader({ "@/lib/auth-options": { authHandler: async (request: Request) => { forwardedBody = await request.formData(); return Response.json({ url: "/fixture-oauth" }); } } })<typeof import("../app/api/auth/[...nextauth]/route")>("app/api/auth/[...nextauth]/route.ts");
  for (const ready of [undefined, "0", "1"]) {
    const data = new URLSearchParams({ csrfToken: "fixture-only", callbackUrl: "/image" });
    if (ready !== undefined) data.set("analyticsReady", ready);
    const response = await route.POST(new Request("https://www.flownana.com/api/auth/signin/google", { method: "POST", headers: { origin: "https://www.flownana.com" }, body: data }) as any, { params: Promise.resolve({ nextauth: ["signin", "google"] }) });
    assert.equal(response.headers.get("set-cookie")?.includes(`${ANALYTICS_BLOCK_COOKIE}=1`) ?? false, ready !== "1");
    assert.equal((forwardedBody as unknown as FormData).get("csrfToken"), "fixture-only");
  }
});
