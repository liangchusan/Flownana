import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type Timing = { name: string; ms: number };
const timings = new AsyncLocalStorage<Timing[]>();

export async function measureRequestStage<T>(name: string, run: () => Promise<T>): Promise<T> {
  const current = timings.getStore();
  if (!current) return run();
  const start = performance.now();
  try { return await run(); }
  finally { current.push({ name, ms: performance.now() - start }); }
}

/** Only fixed route/stage names, durations and a random ID; never account data. */
export async function timedResponse(route: string, run: () => Promise<Response>): Promise<Response> {
  const stages: Timing[] = [];
  const start = performance.now();
  const requestId = randomUUID();
  return timings.run(stages, async () => {
    let status = 500;
    try {
      const response = await run();
      status = response.status;
      stages.push({ name: "total", ms: performance.now() - start });
      response.headers.set("Server-Timing", stages.map(s => `${s.name};dur=${s.ms.toFixed(1)}`).join(", "));
      response.headers.set("X-Request-Id", requestId);
      return response;
    } finally {
      console.info(JSON.stringify({ event: "request_timing", route, requestId, status,
        durationMs: Math.round(performance.now() - start),
        stages: stages.map(s => ({ name: s.name, ms: Math.round(s.ms) })),
      }));
    }
  });
}
