import assert from "node:assert/strict";
import test from "node:test";
import { parseComposerPreference } from "../lib/composer-preference.ts";

test("new generic Create entries default to video", () => {
  assert.equal(parseComposerPreference(null), "video");
  assert.equal(parseComposerPreference("unknown"), "video");
});

test("a valid previous Create type is restored", () => {
  assert.equal(parseComposerPreference("image"), "image");
  assert.equal(parseComposerPreference("video"), "video");
});
