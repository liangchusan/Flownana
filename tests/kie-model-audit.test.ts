import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { IMAGE_MODEL_OPTIONS, VIDEO_MODEL_OPTIONS, getVideoModelName } from "../lib/generation-pricing.ts";
import { createSourceLoader } from "./helpers/load-source.ts";
const evidence = JSON.parse(readFileSync(new URL("../docs/KIE-MODEL-CONTRACTS.json", import.meta.url), "utf8"));
const load = createSourceLoader({});
const { buildKieImageRequest } = load<any>("lib/kie-image-request.ts");
const { getKieMarketVideoTaskBody } = load<any>("lib/kie-video-request.ts");
function validate(model: string, input: Record<string, unknown>) {
  const schema = evidence.inputSchemas[model]; assert.ok(schema, model);
  for (const required of schema.required ?? []) assert.ok(required in input, `${model}.${required}`);
  for (const [key, value] of Object.entries(input)) {
    // Both model playgrounds expose their shared safety flag through a referenced schema.
    if (key === "nsfw_checker" && ["bytedance/seedance-2-mini", "wan/3-0-video"].includes(model)) { assert.equal(value, true); continue; }
    const field = schema.properties[key]; assert.ok(field, `${model} undocumented field ${key}`);
    if (field.type === "array") { assert.ok(Array.isArray(value)); if (field.maxItems) assert.ok(value.length <= field.maxItems); }
    else if (field.type === "integer") assert.ok(Number.isInteger(value));
    else assert.equal(typeof value, field.type);
    if (field.enum) assert.ok(field.enum.includes(value), `${model}.${key}=${value}`);
    if (field.maxLength) assert.ok(String(value).length <= field.maxLength);
    if (field.minLength) assert.ok(String(value).length >= field.minLength);
  }
}
test("every active model name matches the official KIE source snapshot", () => {
  const activeNames = [...IMAGE_MODEL_OPTIONS.map(model => model.label), ...new Set(VIDEO_MODEL_OPTIONS.map(getVideoModelName))];
  assert.deepEqual(activeNames, evidence.sources.names.map((model: { name: string }) => model.name));
  for (const [model, schema] of Object.entries(evidence.inputSchemas)) { assert.ok(evidence.sources.apiDocs[model]); assert.ok((schema as any).properties); }
});
test("every image model/mode/resolution sends only fields in the official API schema", () => {
  for (const option of IMAGE_MODEL_OPTIONS) for (const resolution of option.resolutions ?? ["1K", "2K", "4K"]) for (const editing of [false, true]) {
    const body = buildKieImageRequest({ modelId: option.id, prompt: "A landscape in sunlight", aspectRatio: "1:1", resolution, ...(editing ? { inputUrls: ["https://media.test/reference.png"] } : {}) });
    validate(body.model, body.input);
  }
});
test("every active video output combination and accepted reference mode follows the official schema", () => {
  for (const option of VIDEO_MODEL_OPTIONS) {
    for (const editing of [false, true]) {
      if (!editing && option.requiresImageInput) continue;
      const body = getKieMarketVideoTaskBody({ option, prompt: "A landscape in sunlight", aspectRatio: option.family === "grok" ? "Auto" : "16:9", generateAudio: true, imageUrls: editing ? ["https://media.test/reference.png"] : [] });
      validate(body.model, body.input);
    }
    if (["seedance", "wan"].includes(option.family)) {
      const body = getKieMarketVideoTaskBody({ option, prompt: "Use every reference", inputs: [{ url: "https://media.test/v.mp4", kind: "video" }, { url: "https://media.test/a.mp3", kind: "audio" }], generateAudio: false });
      validate(body.model, body.input);
      assert.equal("first_frame_url" in body.input, false);
      assert.equal("web_search" in body.input, false);
    }
  }
});
