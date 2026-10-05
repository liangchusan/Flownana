export type AnalyticsCollectionPolicy = { defaultAnalytics: boolean; gpc: boolean };
export type AnalyticsCollectionBasis = "explicit" | "regional_default";
// Conservative MVP allowlist. An unset/unrecognized country never implies permission.
export function analyticsCollectionPolicy(headers: Headers): AnalyticsCollectionPolicy {
  const country = headers.get("x-vercel-ip-country")?.toUpperCase();
  return { defaultAnalytics: ["US", "JP", "TW"].includes(country || ""), gpc: headers.get("sec-gpc") === "1" };
}
export function analyticsCollectionBasis(policy: AnalyticsCollectionPolicy | null, choice: string | null): AnalyticsCollectionBasis | null {
  if (!policy || policy.gpc || choice === "denied") return null;
  if (choice === "granted") return "explicit";
  return choice === null && policy.defaultAnalytics ? "regional_default" : null;
}
export function permitsAnalyticsContext(headers: Headers, basis?: AnalyticsCollectionBasis) {
  const policy = analyticsCollectionPolicy(headers);
  return !policy.gpc && (basis !== "regional_default" || policy.defaultAnalytics);
}
