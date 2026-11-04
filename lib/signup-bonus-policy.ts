import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";

export const SIGNUP_BONUS_CREDITS = 10;
export const SIGNUP_IP_WINDOW_MS = 72 * 60 * 60 * 1000;
export const SIGNUP_BONUS_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const SIGNUP_BONUS_COUNTRIES = ["US", "JP", "KR", "TW", "DE", "FR", "GB"] as const;

// Internal server evidence only; never accept this shape from a request body/cookie.
export type SignupBonusEvidence = { ipHash: string | null; country: string | null };

export function normalizeSignupIp(value: string | null): string | null {
  if (!value || value.includes("%") || !isIP(value.trim())) return null;
  const address = ipaddr.process(value.trim());
  // Local/private/proxy-list/ambiguous addresses cannot establish a public client.
  return address.range() === "unicast" ? address.toString() : null;
}

/** Only Vercel-hosted callbacks may trust Vercel's platform-injected headers.
 * https://vercel.com/docs/headers/request-headers
 * No x-forwarded-for, x-real-ip, cookie, or client-body fallback.
 */
export function signupBonusEvidence(
  headers: Pick<Headers, "get">,
  env: Readonly<Record<string, string | undefined>> = process.env,
): SignupBonusEvidence {
  const empty = { ipHash: null, country: null };
  if (env.VERCEL !== "1" || env.NODE_ENV !== "production" ||
      !["production", "preview"].includes(env.VERCEL_ENV || "")) return empty;
  const key = env.SIGNUP_BONUS_IP_HASH_SECRET;
  if (!key || key.trim().length < 32) return empty;
  const ip = normalizeSignupIp(headers.get("x-vercel-forwarded-for"));
  if (!ip) return empty;
  const country = headers.get("x-vercel-ip-country")?.trim().toUpperCase() || "";
  return {
    ipHash: createHmac("sha256", key).update(`signup-bonus-ip:v1\0${ip}`).digest("hex"),
    country: /^[A-Z]{2}$/.test(country) ? country : null,
  };
}

export function signupCountryEligible(country: string | null): boolean {
  return (SIGNUP_BONUS_COUNTRIES as readonly string[]).includes(country || "");
}
