import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";
const load = createSourceLoader({});
const { buildQuote, quotaLimit, usageDay, resetTime, modelCatalog } = load<any>("lib/agent/contract.ts");
const proposal = { type: "image", summary: "A symbol", prompt: "A green leaf symbol", exactText: [], directions: [{ title: "Leaf", prompt: "A simple leaf" }] };
test("Agent quote defaults and exact text use server-owned pricing and capabilities", () => {
  const q = buildQuote(proposal, [], { userText: "" });
  assert.equal(q.modelId, "gpt-image-2-5-flare"); assert.equal(q.count, 1);
  assert.equal(q.credits, load<any>("lib/generation-pricing.ts").getImageGenerationCredits(q.modelId, q.resolution, 0));
  assert.throws(() => buildQuote({ ...proposal, exactText: ["invented price"] }, [], { userText: "logo" }));
  assert.throws(() => buildQuote({ ...proposal, model: "invented" }, [], { userText: "" }));
  assert.throws(() => buildQuote(proposal, [], { userText: "", templateId: "logo" }));
  const four = buildQuote({ ...proposal, directions: Array(4).fill(proposal.directions[0]) }, [], { userText: "", templateId: "logo" });
  assert.equal(four.count, 4); assert.equal(four.credits, q.credits * 4);
  assert.equal(buildQuote(proposal, [], { userText: "", templateId: "logo", editing: true }).count, 1);
});
test("Agent video defaults and account allowance reject unsupported requests", () => {
  const p = { ...proposal, type: "video", directions: [] };
  const q = buildQuote(p, [], { userText: "" });
  assert.equal(q.model, "Seedance 2.0 Mini"); assert.equal(q.resolution, "720P"); assert.equal(q.duration, 5); assert.equal(q.sound, false); assert.equal(q.count, 1);
  assert.throws(() => buildQuote({ ...p, count: 2 }, [], { userText: "" }));
  assert.throws(() => buildQuote({ ...p, resolution: "1080P" }, [], { userText: "", maxVideoResolution: "720P" }));
});
test("Agent UTC quota boundaries and catalog fit the bounded context", () => {
  assert.equal(quotaLimit(false), 10); assert.equal(quotaLimit(true), 100);
  assert.equal(usageDay(new Date("2026-09-11T23:59:59Z")), "2026-09-11");
  assert.equal(resetTime(new Date("2026-09-11T23:59:59Z")), "2026-09-12T00:00:00.000Z");
  assert.ok(JSON.stringify(modelCatalog()).length < 18000);
});
