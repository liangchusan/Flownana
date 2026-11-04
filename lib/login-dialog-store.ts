"use client";

import { advertisingAccountScope } from "./advertising-consent";

export type LoginDialogState = {
  phase: "closed" | "open" | "connecting";
  pricing: boolean;
  accountScope: string | null;
};
const closed: LoginDialogState = { phase: "closed", pricing: false, accountScope: null };
let state = closed;
const listeners = new Set<() => void>();
let pending: { promise: Promise<undefined>; resolve: () => void } | null = null;
let watching = false;

export const getLoginDialogState = () => state;
export const getServerLoginDialogState = () => closed;
export function subscribeLoginDialog(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function publish(next: LoginDialogState) { state = next; for (const listener of listeners) listener(); }

function reset() {
  const current = pending; pending = null; publish(closed); current?.resolve();
}

/** Opening the entry dialog performs no OAuth or analytics preparation. */
export function requestLoginDialog(pricing = false): Promise<undefined> {
  if (pending) {
    if (pricing && !state.pricing) publish({ ...state, pricing: true });
    return pending.promise;
  }
  if (!watching && typeof window !== "undefined") {
    watching = true;
    window.addEventListener("pageshow", event => { if (event.persisted) reset(); });
  }
  let resolve!: () => void;
  const promise = new Promise<undefined>(done => { resolve = () => done(undefined); });
  pending = { promise, resolve };
  publish({ phase: "open", pricing, accountScope: advertisingAccountScope() });
  return promise;
}

export function closeLoginDialog() { if (state.phase === "open") reset(); }
export function beginLoginDialog() {
  if (state.phase !== "open") return false;
  publish({ ...state, phase: "connecting" }); return true;
}
export function failLoginDialog() { if (state.phase === "connecting") publish({ ...state, phase: "open" }); }
