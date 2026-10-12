export function analyticsRetryDelay(attempts: number, retryAfter: string | null, now = Date.now(), random = Math.random()) {
  const steps = [60_000, 300_000, 900_000, 1_800_000, 3_600_000];
  const base = steps[Math.min(Math.max(0, attempts - 1), steps.length - 1)];
  const supplied = retryAfter === null ? NaN : /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - now;
  // Do not retry earlier than the provider requests; keep malformed headers bounded.
  return Math.max(base + Math.floor(Math.max(0, Math.min(1, random)) * base * 0.1), Number.isFinite(supplied) ? Math.min(86_400_000, Math.max(0, supplied)) : 0);
}

export function authorizedAnalyticsOperator(request: Request) {
  return !!process.env.CRON_SECRET && request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}
