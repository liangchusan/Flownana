import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("runtime code accepts only KIE_API_KEY", async () => {
  const files = [
    ".env.example",
    "app/api/generate/route.ts",
    "app/api/veo/generate/route.ts",
    "app/api/creations/media-url/route.ts",
    "app/api/test-env/route.ts",
    "lib/kie.ts",
  ];

  const offenders: string[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (source.includes("NANO_BANANA_API_KEY")) offenders.push(file);
  }

  assert.deepEqual(offenders, []);
});
