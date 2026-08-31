import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";

const { pollGenerationResult, isConfirmedGenerationFailure, GenerationStatusUnavailableError } = createSourceLoader({})<typeof import("../lib/generation-request-state")>("lib/generation-request-state.ts");
const failure = { response: { status: 503, data: { status: "failed", generationId: "saved", errorCode: "provider_unavailable", refundPending: true } } };

test("only an application rejection or persisted terminal failure confirms failure", () => {
  assert.equal(isConfirmedGenerationFailure(new Error("Network Error")), false);
  assert.equal(isConfirmedGenerationFailure({ response: { status: 502, data: "Bad Gateway" } }), false);
  assert.equal(isConfirmedGenerationFailure(failure, true), true);
  const expired = { response: { status: 401, data: { errorCode: "auth_required" } } };
  assert.equal(isConfirmedGenerationFailure(expired), true);
  assert.equal(isConfirmedGenerationFailure(expired, true), false);
});

test("a transient poll failure retries the read and returns success without a second POST", async () => {
  let reads = 0;
  const result = await pollGenerationResult({ maxAttempts: 4, wait: async () => {}, assertCurrent: () => {}, read: async () => {
    reads++;
    if (reads === 1) throw new Error("Network Error");
    if (reads === 2) throw { response: { status: 504, data: "Gateway Timeout" } };
    return { data: reads === 3 ? { pending: true } : { success: true, videoUrl: "https://example.test/result.mp4" } };
  } });
  assert.equal(reads, 4);
  assert.equal(result.videoUrl, "https://example.test/result.mp4");
});

test("terminal failures retain their refund payload; exhausted reads do not invent failure", async () => {
  await assert.rejects(pollGenerationResult({ wait: async () => {}, assertCurrent: () => {}, read: async () => { throw failure; } }), (error) => error === failure);
  await assert.rejects(pollGenerationResult({ maxAttempts: 2, wait: async () => {}, assertCurrent: () => {}, read: async () => ({ data: { pending: true } }) }), GenerationStatusUnavailableError);
  await assert.rejects(pollGenerationResult({ wait: async () => {}, assertCurrent: () => {}, read: async () => { throw { response: { status: 401 } }; } }), GenerationStatusUnavailableError);
});

test("account disposal during the poll delay never dispatches another read", async () => {
  const cancelled = new DOMException("Account changed", "AbortError");
  await assert.rejects(pollGenerationResult({ wait: async () => {}, assertCurrent: () => { throw cancelled; }, read: async () => { assert.fail("read dispatched after disposal"); } }), (error) => error === cancelled);
});
