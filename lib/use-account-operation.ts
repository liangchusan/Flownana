"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { getAccountScope } from "./account-scope";
import { createAccountOperationOwner } from "./account-operation";

export function useAccountOperation() {
  const { data: session } = useSession();
  const accountScope = getAccountScope(session?.user);
  const owner = useRef<{ scope: string | null; value: ReturnType<typeof createAccountOperationOwner> } | null>(null);
  useLayoutEffect(() => {
    const next = createAccountOperationOwner(accountScope);
    owner.current = { scope: accountScope, value: next };
    return () => { next.dispose(); owner.current = null; };
  }, [accountScope]);
  const capture = useCallback(() => {
    if (!owner.current || owner.current.scope !== accountScope) throw new DOMException("Account operation cancelled", "AbortError");
    return owner.current.value.capture();
  }, [accountScope]);
  return { accountScope, capture };
}
