import assert from "node:assert/strict";
import test from "node:test";
import type { NextRequest } from "next/server";
import { createSourceLoader } from "./helpers/load-source.ts";

test("invalid image requests never reserve credits or call Kie", async () => {
  let reservations = 0;
  let providerCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { providerCalls++; throw new Error("Provider must not be called"); };
  try {
    const load = createSourceLoader({
      "next/server": { NextResponse: { json: Response.json } },
      "next-auth": { getServerSession: async () => ({ user: { id: "fixture" } }) },
      "@/lib/auth-options": { authOptions: {} },
      "@/lib/account-scope": { matchesRequestAccount: () => true },
      "@/lib/generation-lifecycle": { recoverGenerationObligations: async () => undefined,
        reserveGeneration: async () => { reservations++; throw new Error("Must not charge"); } },
      "@/lib/generation-response": { generationErrorResponse: () => Response.json({ unexpected: true }, { status: 500 }) },
      "@/lib/media-storage": {},
      "@/lib/media-assets": { persistOrReuseImageInput: async () => ({ url: "https://example.test/image", contentType: "image/heic", sizeBytes: 100 }), enforceInputMediaSize: async (media: unknown) => media },
    });
    const { POST } = load<typeof import("../app/api/generate/route")>("app/api/generate/route.ts");
    const cases = [
      [{ prompt: "x".repeat(5001) }, "invalid_parameters"],
      [{ model: "gpt-image-2", resolution: "4K", aspectRatio: "1:1" }, "invalid_parameters"],
      [{ model: "qwen-image-3-pro", resolution: "4K" }, "invalid_parameters"],
      [{ model: "nano-banana-2", imageUrls: ["https://example.test/image"] }, "unsupported_file_type"],
      [{ model: "grok-imagine-image-2-0", aspectRatio: "auto" }, "invalid_parameters"],
      [{ model: "grok-imagine-image-2-0", resolution: "1K" }, "invalid_parameters"],
      [{ model: "seedream-5-pro", resolution: "4K" }, "invalid_parameters"],
      [{ model: "seedream-5-pro", prompt: "ab" }, "invalid_parameters"],
      ...(["gpt-image-2-5-flare", "gpt-image-2-5-sunburst"] as const).flatMap(model => [
        [{ model, resolution: "2K", aspectRatio: "27:16" }, "invalid_parameters"],
        [{ model, imageUrls: Array.from({ length: 17 }, () => "https://example.test/image") }, "invalid_parameters"],
      ] as const),
    ] as const;
    for (const [body, errorCode] of cases) {
      const response = await POST(new Request("https://example.test/api/generate", { method: "POST", body: JSON.stringify({ prompt: "A landscape", ...body }) }) as NextRequest);
      assert.equal((await response.json()).errorCode, errorCode, JSON.stringify(body));
    }
    assert.equal(reservations, 0);
    assert.equal(providerCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("image routes dispatch all models through reservation, storage and settlement", async () => {
  const pricing = createSourceLoader({})<typeof import("../lib/generation-pricing")>("lib/generation-pricing.ts");
  const originalFetch = globalThis.fetch;
  try {
    for (const model of pricing.IMAGE_MODEL_OPTIONS) {
      for (const editing of [false, true]) {
        for (const failure of [false, true]) {
          const events: string[] = [];
          let parameters: Record<string, unknown> = {};
          let outbound: { model: string; input: Record<string, unknown> } | undefined;
          globalThis.fetch = async (url, init) => {
            if (String(url).includes("createTask")) {
              events.push("provider");
              outbound = JSON.parse(String(init?.body));
              return Response.json({ code: 200, data: { taskId: "task-fixture" } });
            }
            return Response.json({ code: 200, data: failure ? { state: "fail", failMsg: "Fixture failure" } : { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://example.test/output.png"] }) } });
          };
          const generation = { id: "fixture", status: "processing", parameters: {} };
          const load = createSourceLoader({
            "next/server": { NextResponse: { json: Response.json } },
            "next-auth": { getServerSession: async () => ({ user: { id: "fixture" } }) },
            "@/lib/auth-options": { authOptions: {} },
            "@/lib/account-scope": { matchesRequestAccount: () => true },
            "@/lib/kie": { getKieApiKey: () => "fixture" },
            "@/lib/generation-pricing": pricing,
            "@/lib/generation-lifecycle": {
              recoverGenerationObligations: async () => undefined,
              reserveGeneration: async (request: { parameters: Record<string, unknown>; creditsCost: number }) => {
                assert.equal(request.creditsCost, model.id === "grok-imagine-image-2-0" ? 1 : model.id === "seedream-5-pro" && editing ? 3 : 2);
                events.push("reserve"); parameters = request.parameters; return generation;
              },
              attachGenerationTask: async () => generation,
              isActiveGeneration: () => true,
              claimGenerationOutput: async () => ({ attemptId: "attempt" }),
              recordGenerationOutputPath: async () => events.push("storage-intent"),
              completeGeneration: async () => { events.push("complete"); return { generation: { status: "success", parameters } }; },
              failGeneration: async () => { events.push("refund"); return { generation: { status: "failed" } }; },
              finishGenerationOutputAttempt: async () => undefined,
            },
            "@/lib/generation-response": { generationResponse: (value: unknown) => Response.json(value) },
            "@/lib/media-storage": { persistGeneratedMedia: async ({ beforeUpload }: { beforeUpload: (path: string) => Promise<void> }) => {
              await beforeUpload("fixture.png"); events.push("store"); return { url: "https://example.test/saved.png" };
            } },
            "@/lib/media-assets": { persistOrReuseImageInput: async () => ({ url: "https://example.test/input.png", contentType: "image/png", sizeBytes: 100 }), enforceInputMediaSize: async (media: unknown) => media },
          });
          const { POST } = load<typeof import("../app/api/generate/route")>("app/api/generate/route.ts");
          const response = await POST(new Request("https://example.test/api/generate", { method: "POST", body: JSON.stringify({ prompt: "Landscape", model: model.id, aspectRatio: "1:1", ...(model.resolutions?.length === 0 ? {} : { resolution: "1K" }), ...(editing ? { imageUrls: Array.from({ length: model.id === "seedream-5-pro" ? 10 : model.id.startsWith("gpt-image-2-5-") ? 16 : 1 }, () => "https://example.test/input.png") } : {}) }) }) as NextRequest);
          assert.equal((await response.json()).status, failure ? "failed" : "success");
          assert.equal(outbound?.model, editing ? model.imageToImageModel : model.textToImageModel);
          assert.equal(parameters.resolution, model.resolutions?.length === 0 ? undefined : "1K");
          assert.deepEqual(events, failure ? ["reserve", "provider", "refund"] : ["reserve", "provider", "storage-intent", "store", "complete"]);
        }
      }
    }
  } finally { globalThis.fetch = originalFetch; }
});
