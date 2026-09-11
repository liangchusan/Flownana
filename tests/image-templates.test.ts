import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";
import { readFileSync } from "node:fs";
const catalog = JSON.parse(readFileSync(new URL("../lib/image-templates/catalog.json", import.meta.url), "utf8"));
const load = createSourceLoader({ "./catalog.json": catalog });
const { parseTemplateInput, parseAnalysis, renderTemplatePrompt } = load<any>("lib/image-templates/contract.ts");
const inputFor = (id: string) => ({ templateId: id, prompt: "Create for Flownana. 2026-09-11. 精确保留文字", images: id === "headshot" ? ["https://owned.example/photo.png"] : [], answers: {} });
const ready = () => ({ status: "ready", knownAnswers: { q1: "Subject supplied", q2: "No extra text required", q3: "Natural" }, spec: {
  summary: "A clear concept", subject: "User subject", composition: "Centered", style: "Natural", preserve: ["Identity"], text: ["Flownana"], constraints: ["No invented facts"],
  variants: ["Front", "Angled", "Close-up", "Wide"].map((title) => ({ title, direction: `${title} view within the supplied constraints` })), outputCount: 4,
} });
for (const template of catalog) {
  test(`${template.id}: ten input and output contracts`, async (t) => {
    const input = inputFor(template.id);
    await t.test("complete input reaches confirmation", () => assert.equal(parseAnalysis(ready(), input).status, "ready"));
    await t.test("missing factual field asks a configured question", () => assert.equal(parseAnalysis({ ...ready(), knownAnswers: { q1: "Known" } }, input).questionId, "q2"));
    await t.test("unknown question IDs are rejected", () => assert.throws(() => parseAnalysis({ ...ready(), status: "question", questionId: "invented" }, input)));
    await t.test("answered questions are not repeated", () => assert.throws(() => parseAnalysis({ ...ready(), status: "question", questionId: "q3" }, { ...input, answers: { q3: "Custom" } })));
    await t.test("exact Chinese text is retained", () => { const result = ready(); result.spec.text = ["精确保留文字"]; assert.deepEqual(parseAnalysis(result, input).spec.text, ["精确保留文字"]); });
    await t.test("invented copy is rejected", () => { const result = ready(); result.spec.text = ["50% OFF"]; assert.throws(() => parseAnalysis(result, input)); });
    await t.test("identical directions are rejected", () => { const result = ready(); result.spec.variants[1] = result.spec.variants[0]; assert.throws(() => parseAnalysis(result, input)); });
    await t.test("user count overrides default four", () => { const result = ready(); result.spec.outputCount = 1; assert.equal(parseAnalysis(result, input).spec.outputCount, 1); });
    await t.test("long input is bounded", () => assert.throws(() => parseTemplateInput({ ...input, prompt: "x".repeat(6001) })));
    await t.test("renderer preserves user constraints and excludes cover", () => { const result = parseAnalysis(ready(), input); const prompt = renderTemplatePrompt(template, input, result.spec, 0); assert.ok(prompt.includes(input.prompt)); assert.ok(!prompt.includes(template.cover)); assert.match(prompt, /ONE image/); });
  });
}
test("headshots cannot reach confirmation without a photo", () => assert.equal(parseAnalysis(ready(), { ...inputFor("headshot"), images: [] }).questionId, "q1"));
test("template edits default to one output", () => assert.equal(parseAnalysis(ready(), { ...inputFor("logo"), parentGenerationId: "parent" }).spec.outputCount, 1));
test("OpenRouter retry is bounded and never switches model", async (t) => {
  const originalKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-only";
  t.after(() => { if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = originalKey; });
  const requests: any[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: any) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ choices: [{ message: { content: "invalid json" } }] }) } as any;
  });
  const { understandTemplate } = load<any>("lib/image-templates/understand.ts");
  await assert.rejects(understandTemplate(inputFor("logo")));
  assert.equal(requests.length, 2);
  assert.ok(requests.every((r) => r.model === "qwen/qwen3-vl-32b-instruct" && r.provider.allow_fallbacks === false));
});

test("template batch reservation: concurrency, rollback and quote contracts", async (t) => {
  const { getImageGenerationCredits } = load<any>("lib/generation-pricing.ts");
  const unit = getImageGenerationCredits("gpt-image-2-5-sunburst", "1K", 0);
  const input = inputFor("logo");
  const initialRun = { id: "run", userId: "owner", templateId: "logo", templateVersion: 1, revision: 1, status: "ready", input, analysis: parseAnalysis(ready(), input), generationIds: [] };
  let state: any;
  let failMedia = false;
  let queue = Promise.resolve();
  const reset = () => { state = { run: structuredClone(initialRun), outputs: [], credits: 100, active: 0 }; failMedia = false; };
  const tx: any = {
    imageTemplateRun: { findFirst: async () => state.run, update: async ({ data }: any) => (state.run = { ...state.run, ...data }) },
    generation: { count: async () => state.active + state.outputs.length, create: async ({ data }: any) => { const row = { ...data, id: `output-${state.outputs.length}` }; state.outputs.push(row); return row; } },
    mediaAsset: { findUnique: async () => null },
  };
  const serviceLoad = createSourceLoader({ "./catalog.json": catalog,
    "@/lib/prisma": { prisma: {} },
    "@/lib/generation-lifecycle": { MAX_ACTIVE_OUTPUTS: 5, GenerationRequestError: class extends Error {}, recoverGenerationObligations: async () => {}, withGenerationAccount: async (_account: any, work: any) => {
      const previous = queue; let release!: () => void; queue = new Promise<void>((resolve) => { release = resolve; }); await previous;
      const snapshot = structuredClone(state);
      try { return await work(tx); } catch (e) { state = snapshot; throw e; } finally { release(); }
    } },
    "@/lib/credit-consumption": { consumeCreditsFIFOWithClient: async (_tx: any, _user: string, amount: number) => { if (state.credits < amount) throw new Error("insufficient credits"); state.credits -= amount; return [{ id: "batch", amount }]; } },
    "@/lib/media-assets": { enforceInputMediaSize: async (value: any) => value, syncGenerationMediaAssets: async () => { if (failMedia) throw new Error("media failure"); } },
  });
  const { generateTemplateRun } = serviceLoad<any>("lib/image-templates/service.ts");
  const account = { id: "owner", accountCreatedAt: "2026-09-11T00:00:00.000Z" };
  const settings = { count: 4, resolution: "1K", aspectRatio: "1:1", quotedCredits: unit * 4 };
  await t.test("simultaneous duplicate requests reserve exactly one group", async () => { reset(); const results = await Promise.all([generateTemplateRun(account, "run", 1, settings), generateTemplateRun(account, "run", 1, settings)]); assert.equal(results.flatMap((r: any) => r.outputs).length, 4); assert.equal(state.credits, 100 - unit * 4); assert.equal(results.filter((r: any) => r.replay).length, 1); });
  await t.test("not enough slots rejects whole batch", async () => { reset(); state.active = 2; await assert.rejects(generateTemplateRun(account, "run", 1, settings)); assert.equal(state.outputs.length, 0); assert.equal(state.credits, 100); });
  await t.test("stale revision cannot create tasks", async () => { reset(); await assert.rejects(generateTemplateRun(account, "run", 0, settings)); assert.equal(state.credits, 100); });
  await t.test("changed quote requires review", async () => { reset(); await assert.rejects(generateTemplateRun(account, "run", 1, { ...settings, quotedCredits: 1 })); assert.equal(state.credits, 100); });
  await t.test("insufficient credits roll back earlier outputs", async () => { reset(); state.credits = unit * 2; await assert.rejects(generateTemplateRun(account, "run", 1, settings)); assert.equal(state.outputs.length, 0); assert.equal(state.credits, unit * 2); });
  await t.test("media failure rolls back credits and task creation", async () => { reset(); failMedia = true; await assert.rejects(generateTemplateRun(account, "run", 1, settings)); assert.equal(state.outputs.length, 0); assert.equal(state.credits, 100); });
});
