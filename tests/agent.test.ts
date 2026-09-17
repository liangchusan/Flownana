import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";
const load = createSourceLoader({});
const { buildQuote, quotaLimit, usageDay, resetTime, modelCatalog, messageSchema } = load<any>("lib/agent/contract.ts");
const proposal = { type: "image", summary: "A symbol", prompt: "A green leaf symbol", exactText: [], directions: [] };
test("Agent quote defaults and exact text use server-owned pricing and capabilities", () => {
  const q = buildQuote(proposal, [], { userText: "" });
  assert.equal(q.modelId, "gpt-image-2-5-flare"); assert.equal(q.count, 4); assert.deepEqual(q.directions, []);
  assert.equal(q.credits, load<any>("lib/generation-pricing.ts").getImageGenerationCredits(q.modelId, q.resolution, 0) * 4);
  assert.throws(() => buildQuote({ ...proposal, exactText: ["invented price"] }, [], { userText: "logo" }));
  assert.throws(() => buildQuote({ ...proposal, model: "invented" }, [], { userText: "" }));
  const four = buildQuote(proposal, [], { userText: "", templateId: "logo" });
  assert.equal(four.count, 4); assert.equal(four.credits, q.credits);
  assert.equal(buildQuote(proposal, [], { userText: "", templateId: "logo", editing: true }).count, 1);
});
test("Agent video defaults and account allowance reject unsupported requests", () => {
  const p = { ...proposal, type: "video", directions: [] };
  const q = buildQuote(p, [], { userText: "" });
  assert.equal(q.model, "Seedance 2.0 Mini"); assert.equal(q.resolution, "720P"); assert.equal(q.duration, 5); assert.equal(q.sound, true); assert.equal(q.count, 1);
  assert.throws(() => buildQuote({ ...p, count: 2 }, [], { userText: "" }));
  assert.throws(() => buildQuote({ ...p, resolution: "1080P" }, [], { userText: "", maxVideoResolution: "720P" }));
});
test("Agent UTC quota boundaries and catalog fit the bounded context", () => {
  assert.equal(quotaLimit(false), 10); assert.equal(quotaLimit(true), 100);
  assert.equal(usageDay(new Date("2026-09-11T23:59:59Z")), "2026-09-11");
  assert.equal(resetTime(new Date("2026-09-11T23:59:59Z")), "2026-09-12T00:00:00.000Z");
  assert.ok(JSON.stringify(modelCatalog()).length < 18000);
});
test("Agent accepts a reference-only continuation but never an empty message", () => {
  const base = { conversationId: "0e9b8ba4-0b17-4f76-933d-f7ef62d8ce83", id: "1e9b8ba4-0b17-4f76-933d-f7ef62d8ce83", revision: 0 };
  assert.equal(messageSchema.parse({ ...base, prompt: "", inputs: [{ url: "https://example.test/reference.png", kind: "image" }] }).prompt, "");
  assert.equal(messageSchema.parse({ ...base, prompt: "", inputs: [{ url: "https://example.test/reference.mp4", kind: "video" }] }).inputs[0]?.kind, "video");
  assert.throws(() => messageSchema.parse({ ...base, prompt: "", inputs: [] }));
});

test("Agent whitelist and sound are enforced independently of hidden UI controls", () => {
  const video = { ...proposal, type: "video", directions: [] };
  assert.equal(buildQuote({ ...video, sound: false }, [], { userText: "silent" }).sound, false);
  assert.equal(buildQuote({ ...video, model: "MiniMax H3" }, [], { userText: "" }).sound, true);
  assert.equal(buildQuote({ ...video, model: "Gemini Omni Video", duration: 4 }, [], { userText: "" }).sound, true);
  assert.throws(() => buildQuote({ ...video, model: "Gemini Omni Video", duration: 4, sound: false }, [], { userText: "" }), /sound/);
  assert.throws(() => buildQuote({ ...video, model: "MiniMax H3", resolution: "2K" }, [], { userText: "", maxVideoResolution: "4K" }), /resolution/);
  assert.throws(() => buildQuote({ ...proposal, aspectRatio: "3:2" }, [], { userText: "" }), /ratio/);
  const refs = [{ url: "https://example.test/input.png", kind: "image", role: "subject" }];
  assert.equal(buildQuote({ ...video, model: "MiniMax H3" }, refs, { userText: "" }).aspectRatio, "Auto");
  assert.throws(() => buildQuote({ ...video, model: "MiniMax H3", aspectRatio: "16:9" }, refs, { userText: "" }), /input image/);
});
