/** Keep Checkout cancellation on the page that opened Pricing, without an open redirect. */
export function checkoutCancelUrl(baseUrl: string, returnTo: unknown): string {
  const fallback = `${baseUrl}/pricing`;
  if (typeof returnTo !== "string" || returnTo.length > 1024 ||
    !returnTo.startsWith("/") || returnTo.startsWith("//") ||
    /[\\\r\n\0]/.test(returnTo) || returnTo.includes("#")) return fallback;
  try {
    const origin = new URL(baseUrl).origin;
    const target = new URL(returnTo, origin);
    if (target.origin !== origin || target.pathname.startsWith("/api/")) return fallback;
    for (const key of ["checkout", "upgrade", "session_id", "from", "to", "payable", "credit", "currency"])
      target.searchParams.delete(key);
    return `${target.origin}${target.pathname}${target.search}#pricing`;
  } catch { return fallback; }
}
