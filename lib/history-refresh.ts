/** A server seed is usable only for the same account and a short, bounded age.
 * Cached/prefetched RSC responses and clock skew must never postpone a refresh.
 */
export function initialHistoryRefreshDelay(loadedAt: number | undefined, now = Date.now()) {
  const age = loadedAt === undefined ? Infinity : now - loadedAt;
  return Number.isFinite(age) && age >= 0 && age < 10_000 ? 10_000 - age : 0;
}
