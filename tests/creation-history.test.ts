import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeCreations,
  normalizeGenerationParameters,
  type CreationHistoryItem,
} from "../lib/creation-history.ts";

function item(overrides: Partial<CreationHistoryItem>): CreationHistoryItem {
  return {
    id: "id",
    type: "image",
    status: "pending",
    urls: [],
    prompt: "prompt",
    createdAt: "2026-05-18T00:00:00.000Z",
    ...overrides,
  };
}

test("mergeCreations dedupes optimistic and persisted rows by taskId", () => {
  const optimistic = item({
    id: "task-1",
    taskId: "task-1",
    status: "generating",
    createdAt: "2026-05-18T00:00:01.000Z",
  });
  const persisted = item({
    id: "db-1",
    taskId: "task-1",
    status: "success",
    urls: ["https://blob.example/image.png"],
    createdAt: "2026-05-18T00:00:00.000Z",
  });

  const merged = mergeCreations([persisted], [optimistic]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "db-1");
  assert.equal(merged[0].status, "success");
  assert.deepEqual(merged[0].urls, ["https://blob.example/image.png"]);
});

test("mergeCreations keeps distinct tasks sorted newest first", () => {
  const older = item({
    id: "older",
    taskId: "older-task",
    status: "success",
    createdAt: "2026-05-18T00:00:00.000Z",
  });
  const newer = item({
    id: "newer",
    taskId: "newer-task",
    status: "success",
    createdAt: "2026-05-18T00:00:02.000Z",
  });

  const merged = mergeCreations([older, newer], []);

  assert.deepEqual(
    merged.map((creation) => creation.id),
    ["newer", "older"]
  );
});

test("normalizeGenerationParameters keeps only supported display fields", () => {
  assert.deepEqual(
    normalizeGenerationParameters({
      model: " GPT Image 2 ",
      resolution: "2K",
      aspectRatio: "3:4",
      duration: Number.NaN,
      privateValue: "hidden",
    }),
    {
      model: "GPT Image 2",
      resolution: "2K",
      aspectRatio: "3:4",
      duration: undefined,
      audio: undefined,
      mode: undefined,
    }
  );
});
