export const ACCOUNT_SCOPE_HEADER = "x-flownana-account";

export type ScopedAccount = { id?: string | null; accountCreatedAt?: string | null };

/** An email or bare ID cannot distinguish a deleted account from re-registration. */
export function getAccountScope(account?: ScopedAccount | null): string | null {
  if (!account?.id || !account.accountCreatedAt) return null;
  const createdAt = new Date(account.accountCreatedAt);
  if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== account.accountCreatedAt) return null;
  return `v1:${encodeURIComponent(account.id)}:${account.accountCreatedAt}`;
}

export function accountRequestHeaders(scope: string, initial?: HeadersInit): Headers {
  const headers = new Headers(initial);
  headers.set(ACCOUNT_SCOPE_HEADER, scope);
  return headers;
}

/** Legacy callers may omit this; account-bound browser requests send their captured scope. */
export function matchesRequestAccount(request: Request, account: ScopedAccount): boolean {
  const expected = request.headers.get(ACCOUNT_SCOPE_HEADER);
  return expected === null || expected === getAccountScope(account);
}
