import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { measurementIdForEnvironment } from "./analytics-policy";

export const ADS_POLICY_VERSION = "2026-10-12-v2";
export function enhancedConversionsEnabled() {
  return process.env.NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_GA_ENABLED === "true" &&
    !!measurementIdForEnvironment(process.env.VERCEL_ENV, process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
}
const environment = () => process.env.VERCEL_ENV === "production" ? "production" : "test";
export const adsConsentKey = (userId: string) => `${environment()}:${userId}:advertising`;
export function hashConversionEmail(email: string) {
  const normalized = email.toLowerCase().replace(/\s/g, "");
  if (normalized.length > 254 || !/^[^@]+@[^@]+\.[^@]+$/.test(normalized)) return null;
  const [local, domain] = normalized.split("@");
  return createHash("sha256").update(`${["gmail.com", "googlemail.com"].includes(domain) ? local.replace(/\./g, "") : local}@${domain}`).digest("hex");
}
type Consent = { purpose: "advertising_measurement"; version: string; token: string; grantedAt: number; storage: true; userData: true; emailProof: string;
  basis: "explicit" | "regional_default"; country?: string; expiresAt?: number };
export function consentEmailProof(email: string) {
  if (!process.env.NEXTAUTH_SECRET) throw new Error("Consent unavailable");
  return createHmac("sha256", process.env.NEXTAUTH_SECRET).update(`ads-email:${email}`).digest("hex");
}
export function readAdsConsent(value: unknown): Consent | null {
  const c = value as Consent | null;
  return c?.purpose === "advertising_measurement" && [ADS_POLICY_VERSION, "2026-10-12-v1"].includes(c.version) &&
    typeof c.token === "string" && /^[0-9a-f-]{36}$/.test(c.token) && Number.isSafeInteger(c.grantedAt) && c.grantedAt > 0 &&
    c.grantedAt <= Date.now() && c.storage === true && c.userData === true && /^[a-f0-9]{64}$/.test(c.emailProof) &&
    (c.basis === undefined || c.basis === "explicit" || (c.basis === "regional_default" && ["US", "TW"].includes(c.country || "") &&
      Number.isSafeInteger(c.expiresAt) && c.expiresAt! > Date.now() && c.expiresAt! > c.grantedAt))
      ? { ...c, basis: c.basis || "explicit" } : null;
}
export function newAdsConsent(email: string, country?: string): Consent {
  const grantedAt = Date.now();
  return { purpose: "advertising_measurement", version: ADS_POLICY_VERSION, token: randomUUID(), grantedAt, storage: true, userData: true, emailProof: consentEmailProof(email),
    basis: country ? "regional_default" : "explicit", ...(country ? { country, expiresAt: grantedAt + 180 * 86400_000 } : {}) };
}
// Domain-separated signed receipt permits withdrawal after logout, never a grant.
export function adsWithdrawalReceipt(userId: string, epoch: string, token: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Consent unavailable");
  const body = Buffer.from(JSON.stringify({ userId, epoch, token, environment: environment() })).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(`ads-withdrawal:${body}`).digest("base64url")}`;
}
export function readAdsWithdrawalReceipt(value: unknown) {
  if (typeof value !== "string" || value.length > 1500 || !process.env.NEXTAUTH_SECRET) return null;
  try {
    const [body, signature, extra] = value.split(".");
    if (!body || !signature || extra) return null;
    const expected = createHmac("sha256", process.env.NEXTAUTH_SECRET).update(`ads-withdrawal:${body}`).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const c = JSON.parse(Buffer.from(body, "base64url").toString()) as { userId: string; epoch: string; token: string; environment: string };
    return c.environment === environment() && typeof c.userId === "string" && typeof c.token === "string" && typeof c.epoch === "string" ? c : null;
  } catch { return null; }
}
export async function purchaseAdsEvidence(tx: Prisma.TransactionClient, userId: string, occurredAt: Date, country?: string) {
  if (!enhancedConversionsEnabled()) return null;
  const [stored, user] = await Promise.all([
    tx.analyticsContext.findUnique({ where: { id: adsConsentKey(userId) } }),
    tx.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);
  const consent = readAdsConsent(stored?.context);
  return user && stored && consent && (consent.basis === "explicit" || (country === consent.country && ["US", "TW"].includes(country || ""))) &&
    user.createdAt.getTime() === stored.accountCreatedAt.getTime() && consent.grantedAt <= occurredAt.getTime()
    ? { token: consent.token, epoch: stored.accountCreatedAt.toISOString() } : null;
}
