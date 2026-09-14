import { accountRequestHeaders } from "./account-scope";
import type { AgentSnapshot } from "../components/blocks/agent/types";

type AgentRead = { ok: boolean; data: AgentSnapshot & { accountScope?: string; error?: string; code?: string } };
type Pending = { promise: Promise<AgentRead>; controller: AbortController; readers: number };
const requests = new Map<string, Pending>();
let listening = false;

export function invalidateAgentReads() {
  for (const pending of requests.values()) pending.controller.abort();
  requests.clear();
}

/** Coalesce only in-flight GETs. No persistent/private response cache. Each
 * subscriber can cancel without cancelling other consumers of the same read.
 */
export function fetchAgentSnapshot(scope: string, id?: string, signal?: AbortSignal): Promise<AgentRead> {
  if (signal?.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"));
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("agent-conversations-changed", invalidateAgentReads);
    window.addEventListener("storage", event => {
      if (event.key === null || event.key === "nextauth.message") invalidateAgentReads();
    });
  }
  const url = `/api/agent${id ? `?id=${encodeURIComponent(id)}` : ""}`;
  const key = JSON.stringify([scope, url]);
  let pending = requests.get(key);
  if (!pending) {
    const controller = new AbortController();
    const entry: Pending = { controller, readers: 0, promise: Promise.resolve(null as never) };
    entry.promise = fetch(url, { headers: accountRequestHeaders(scope), signal: controller.signal, cache: "no-store" })
      .then(async res => ({ ok: res.ok, data: await res.json() as AgentRead["data"] }))
      .then(result => {
        if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
        return result;
      })
      .finally(() => { if (requests.get(key) === entry) requests.delete(key); });
    requests.set(key, entry);
    pending = entry;
  }
  const entry = pending;
  entry.readers++;
  return new Promise((resolve, reject) => {
    let finished = false;
    const release = () => {
      if (finished) return false;
      finished = true;
      signal?.removeEventListener("abort", cancel);
      if (--entry.readers === 0 && requests.get(key) === entry) {
        requests.delete(key);
        entry.controller.abort();
      }
      return true;
    };
    const cancel = () => { if (release()) reject(new DOMException("Cancelled", "AbortError")); };
    signal?.addEventListener("abort", cancel, { once: true });
    entry.promise.then(result => { if (release()) resolve(result); }, error => { if (release()) reject(error); });
  });
}
