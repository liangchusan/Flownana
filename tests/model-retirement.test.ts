import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";
import { VIDEO_MODEL_OPTION_MAP, AVAILABLE_VIDEO_MODEL_IDS } from "../lib/generation-pricing.ts";

function videoRoute(actualDuration = 5) {
  let debits = 0, dispatches = 0, cost = -1;
  const load = createSourceLoader({
    "next/server": { NextResponse: { json: Response.json } },
    "next-auth": { getServerSession: async () => ({ user: { id: "owner" } }) },
    "@/lib/auth-options": { authOptions: {} },
    "@/lib/account-scope": { matchesRequestAccount: () => true },
    "@/lib/inspect-reference": { validateReferenceDurations: async (_: unknown, refs: Array<{ kind: string }>) => refs.map(ref => ({ kind: ref.kind, ...(ref.kind === "video" ? { durationSeconds: actualDuration } : {}) })) },
    "@/lib/media-assets": { persistOrReuseMediaInput: async ({ source, kind }: { source: string; kind: string }) => ({ url: source, contentType: kind === "video" ? "video/mp4" : "image/png", sizeBytes: 1024 }), enforceInputMediaSize: async (media: unknown) => media },
    "@/lib/generation-lifecycle": { recoverGenerationObligations: async () => undefined, reserveGeneration: async (request: { creditsCost: number }) => { debits++; cost = request.creditsCost; return { id: "paid", status: "pending" }; }, attachGenerationTask: async () => ({ id: "paid", status: "processing" }) },
    "@/lib/generation-response": { generationResponse: (value: unknown) => Response.json(value), generationErrorResponse: () => Response.json({ unexpected: true }, { status: 500 }) },
    "@/lib/video-generation-service": {
      resolveVideoOption: ({ modelOptionId, model }: { modelOptionId?: string; model?: string }) => modelOptionId != null && AVAILABLE_VIDEO_MODEL_IDS.has(modelOptionId) ? VIDEO_MODEL_OPTION_MAP[modelOptionId] : model != null || modelOptionId != null ? null : VIDEO_MODEL_OPTION_MAP.seedance2mini_480_4,
      createVideoTask: async () => { dispatches++; return "provider-task"; },
      videoErrorResponse: (errorCode: string, status = 400, extra = {}) => Response.json({ errorCode, ...extra }, { status }),
    },
  });
  const { POST } = load<any>("app/api/veo/generate/route.ts");
  return { post: (body: unknown) => POST(new Request("https://fixture.test/api/veo/generate", { method: "POST", body: JSON.stringify(body) })), state: () => ({ debits, dispatches, cost }) };
}

test("retired and unknown video selections cannot create a new paid task", async () => {
  for (const id of ["geminiomni_720_4", "happyhorse11_720_3", "minimaxh3_2k_4", "unknown", "__proto__", ""]) {
    const route = videoRoute(); const response = await route.post({ prompt: "A moving landscape", modelOptionId: id });
    assert.equal(response.status, 400, id); assert.deepEqual(route.state(), { debits: 0, dispatches: 0, cost: -1 });
  }
});
test("server calculates video-reference cost from measured bytes, not client duration or price", async () => {
  const body = { prompt: "Move the camera", modelOptionId: "seedance2mini_720_5", inputs: [{ url: "https://media.test/owned.mp4", kind: "video", durationSeconds: 100 }], quotedCredits: 10 };
  const valid = videoRoute(5);
  assert.equal((await valid.post(body)).status, 200);
  assert.deepEqual(valid.state(), { debits: 1, dispatches: 1, cost: 10 });
  for (const quotedCredits of [1, undefined, 10.5, "10"]) {
    const route = videoRoute(5); assert.equal((await route.post({ ...body, quotedCredits })).status, 400);
    assert.equal(route.state().debits, 0); assert.equal(route.state().dispatches, 0);
  }
});
test("Grok prompt and image ratio limitations reject before payment", async () => {
  for (const override of [{ prompt: "x".repeat(4097) }, { aspectRatio: "16:9" }, { inputs: [] }]) {
    const route = videoRoute();
    assert.equal((await route.post({ prompt: "Move camera", modelOptionId: "grok15_720_5", inputs: [{ url: "https://media.test/image.png", kind: "image" }], ...override })).status, 400);
    assert.equal(route.state().debits, 0);
  }
});
test("Grok 480P one-second task reserves the approved one-credit minimum", async () => {
  const route = videoRoute();
  assert.equal((await route.post({ prompt: "Move camera", modelOptionId: "grok15_480_1", quotedCredits: 1, inputs: [{ url: "https://media.test/image.png", kind: "image" }] })).status, 200);
  assert.deepEqual(route.state(), { debits: 1, dispatches: 1, cost: 1 });
  const stale = videoRoute();
  assert.equal((await stale.post({ prompt: "Move camera", modelOptionId: "grok15_480_1", quotedCredits: 0, inputs: [{ url: "https://media.test/image.png", kind: "image" }] })).status, 400);
  assert.equal(stale.state().debits, 0);
});
test("new Gemini uses its new price and 7-image contract", async () => {
  const route = videoRoute(); assert.equal((await route.post({ prompt: "Move camera", modelOptionId: "geminiomni11_720_4", aspectRatio: "16:9", quotedCredits: 13 })).status, 200);
  assert.deepEqual(route.state(), { debits: 1, dispatches: 1, cost: 13 });
  const invalid = videoRoute(); assert.equal((await invalid.post({ prompt: "Move camera", modelOptionId: "geminiomni11_720_4", inputs: Array(8).fill({ url: "https://media.test/img.png", kind: "image" }) })).status, 400);
  assert.equal(invalid.state().debits, 0);
});
test("actual video resolver rejects explicit blank and legacy IDs while preserving empty-request default", () => {
  const load = createSourceLoader({ "@/lib/prisma": { prisma: {} } });
  const { resolveVideoOption } = load<any>("lib/video-generation-service.ts");
  for (const modelOptionId of ["", "__proto__", "geminiomni_720_4", "happyhorse11_720_3"]) assert.equal(resolveVideoOption({ modelOptionId }), null);
  assert.equal(resolveVideoOption({ model: "" }), null);
  assert.equal(resolveVideoOption({}).id, "seedance2mini_480_4");
});
