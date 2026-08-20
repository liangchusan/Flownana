import assert from "node:assert/strict";
import test from "node:test";
import {
  SUNO_RETIREMENT_BODY,
  SUNO_RETIREMENT_STATUS,
} from "../lib/model-retirement.ts";

test("retired Suno endpoint uses a stable HTTP 410 response contract", () => {
  assert.equal(SUNO_RETIREMENT_STATUS, 410);
  assert.deepEqual(SUNO_RETIREMENT_BODY, {
    error: "Audio generation is no longer available.",
    code: "model_retired",
  });
});
