/** Unscoped legacy payloads cannot establish which account owned a private draft. */
export function readAgentLoginRecovery<T>(raw: string | null, scope: string): T | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (value?.version !== 1 || (value.sourceScope !== null && value.sourceScope !== scope)) return null;
    return value.draft ?? null;
  } catch { return null; }
}
