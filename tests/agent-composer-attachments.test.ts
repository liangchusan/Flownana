import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Agent references reuse the shared media thumbnail and retain video duration", () => {
  const composer = readFileSync(new URL("../components/blocks/agent/agent-composer.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/blocks/agent/agent-workspace.tsx", import.meta.url), "utf8");
  assert.match(composer, /import \{ ComposerAttachments, CreationModeSelector \}/);
  assert.match(composer, /<ComposerAttachments attachments=\{draft\.inputs\.map/);
  assert.doesNotMatch(composer, /\{ref\.kind\} reference/);
  assert.match(workspace, /durationSeconds = output\.type === "video"/);
  assert.match(workspace, /\{ durationSeconds \}/);
});
