import { ACCOUNT_SCOPE_HEADER } from "./account-scope";

/** One mounted account owner. Never shared between SessionProviders. */
export function createAccountOperationOwner(accountScope: string | null) {
  const controller = new AbortController();
  const assertCurrent = () => {
    if (controller.signal.aborted) throw new DOMException("Account operation cancelled", "AbortError");
    if (!accountScope) throw new Error("Sign in before continuing.");
  };
  return {
    dispose: () => controller.abort(),
    capture: () => {
      assertCurrent();
      return {
        headers: { [ACCOUNT_SCOPE_HEADER]: accountScope! },
        signal: controller.signal,
        assertCurrent,
      };
    },
  };
}

export function isAccountOperationCancelled(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.name === "CanceledError");
}

export type CaptureAccountOperation = ReturnType<typeof createAccountOperationOwner>["capture"];
