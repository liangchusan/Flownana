import assert from "node:assert/strict";
import test from "node:test";
import { MockLanguageModelV4 } from "ai/test";
import { createSourceLoader } from "./helpers/load-source.ts";
const usage = { inputTokens: { total: 200, noCache: 200, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 30, text: 30, reasoning: 0 } };
async function run(parts: any[], options: { template?: any; outputs?: any[] } = {}) {
  const completed: any[] = [], failed: any[] = [], costs: any[] = [];
  const model = new MockLanguageModelV4({ doStream: async () => ({ stream: new ReadableStream({ start(controller) { for (const p of parts) controller.enqueue(p); controller.close(); } }) }) });
  const load = createSourceLoader({
    "@ai-sdk/openai-compatible": { createOpenAICompatible: () => ({ chatModel: () => model }) },
    "./service": {
      turnContext: async () => ({ template: options.template ?? null, rights: { maxVideoResolution: "720P" }, userText: "A symbol without text", history: [], source: "", outputs: options.outputs ?? [] }),
      saveAgentProgress: async () => true,
      finishAgentTurn: async (_a: any, _t: any, result: any) => { completed.push(result); },
      failAgentTurn: async (...args: any[]) => { failed.push(args); },
      recordAgentUsage: async (_a: any, _t: any, value: any) => { costs.push(value); },
    },
  });
  await load<any>("lib/agent/understand.ts").understandAgent({ id: "test", accountCreatedAt: new Date().toISOString() }, { id: "turn", attempt: 1, prompt: "A symbol without text", inputs: [] });
  return { completed, failed, costs, calls: model.doStreamCalls };
}
const start = { type: "stream-start", warnings: [] };
const finish = (reason = "stop") => ({ type: "finish", finishReason: { unified: reason, raw: reason }, usage });
test("Agent actual AI SDK tool loop creates a priced proposal without dispatching media", async () => {
  const value = { type: "image", summary: "A symbol", prompt: "A leaf symbol", exactText: [], directions: [{ title: "Leaf", prompt: "Simple green leaf" }] };
  const result = await run([start, { type: "tool-call", toolCallId: "q", toolName: "prepare_generation", input: JSON.stringify(value) }, finish("tool-calls")]);
  assert.equal(result.failed.length, 0); assert.equal(result.completed.length, 1);
  assert.equal(result.completed[0].quote.modelId, "gpt-image-2-5-flare"); assert.equal(result.calls.length, 1);
  assert.equal(result.costs[0].inputTokens, 200);
});
test("Agent actual AI SDK question produces clickable answers", async () => {
  const result = await run([start, { type: "tool-call", toolCallId: "q", toolName: "ask_question", input: JSON.stringify({ conversationTitle: "Leaf logo design", text: "Which style?", options: ["Minimal", "Playful"] }) }, finish("tool-calls")]);
  assert.equal(result.completed[0].title, "Leaf logo design");
  assert.equal(result.completed[0].kind, "question"); assert.deepEqual(result.completed[0].suggestions, ["Minimal", "Playful"]);
});
test("Agent partial provider errors and token truncation do not complete a reply", async () => {
  for (const ending of [{ type: "error", error: new Error("provider disconnected") }, finish("length")]) {
    const result = await run([start, { type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: "Partial answer" }, { type: "text-end", id: "t" }, ending]);
    assert.equal(result.completed.length, 0); assert.equal(result.failed.length, 1);
  }
});

test("Agent selects a prior image for video and rejects unavailable output ids", async () => {
  const proposal = { type: "video", summary: "Animate the second image", prompt: "Gentle camera movement", exactText: [], selectedOutputId: "second-image", directions: [] };
  const parts = [start, { type: "tool-call", toolCallId: "q", toolName: "prepare_generation", input: JSON.stringify(proposal) }, finish("tool-calls")];
  const selected = await run(parts, { outputs: [{ id: "second-image", urls: ["https://fixture.example.test/second.png"], inputUrls: ["https://fixture.example.test/brand.png"], prompt: "Preserve ACME and the blue geometric layout", parameters: { outputIndex: 1 } }] });
  assert.equal(selected.completed.length, 1);
  assert.equal(selected.completed[0].quote.inputs[0].url, "https://fixture.example.test/second.png");
  assert.equal(selected.completed[0].quote.inputs[1].url, "https://fixture.example.test/brand.png");
  assert.equal(selected.completed[0].quote.prompt, "Gentle camera movement");
  const missing = await run(parts);
  assert.equal(missing.completed.length, 0); assert.equal(missing.failed.length, 1); assert.ok(missing.calls.length <= 3);
});
