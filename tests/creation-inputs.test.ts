import assert from "node:assert/strict";
import test from "node:test";
import { restoreCreationInputs } from "../lib/creation-inputs.ts";
import { normalizeGenerationParameters } from "../lib/creation-history.ts";

test("typed input restoration keeps occurrence order and does not trust unrelated saved URLs", () => {
  const media = [{ mediaAsset: { url: "sound", type: "music" } }, { mediaAsset: { url: "image", type: "image" } }];
  assert.deepEqual(restoreCreationInputs(["image", "sound", "image"], media), { inputUrls: ["image", "sound", "image"], inputKinds: ["image", "audio", "image"] });
  assert.deepEqual(restoreCreationInputs(["output-not-input"], media), { inputUrls: ["sound", "image"], inputKinds: ["audio", "image"] });
  assert.deepEqual(restoreCreationInputs(["legacy-input"], []), { inputUrls: ["legacy-input"] });
  assert.equal(normalizeGenerationParameters({ inputKinds: ["image", "invalid", "video"] })?.inputKinds, undefined);
});
