import assert from "node:assert/strict";
import test from "node:test";
import {
  formatProcessingDuration,
  formatConversationTimestamp,
  getCreationRunRemovalTarget,
  getCreationTimelineKey,
  mergeCreations,
  reconcileCreationSnapshot,
  getRegenerationInputImage,
  normalizeGenerationParameters,
  shouldShowConversationTimestamp,
  type CreationHistoryItem,
} from "../lib/creation-history.ts";

function item(overrides: Partial<CreationHistoryItem>): CreationHistoryItem {
  return {
    id: "id",
    type: "image",
    status: "pending",
    urls: [],
    inputUrls: [],
    prompt: "prompt",
    createdAt: "2026-05-18T00:00:00.000Z",
    ...overrides,
  };
}

test("server history wins over cached success, deleted URLs and hidden state", () => {
  const old = item({ status: "success", urls: ["one", "two"] });
  const partial = item({ status: "success", urls: ["two"], parameters: { hiddenFromRecent: true } });
  assert.deepEqual(reconcileCreationSnapshot([old], [partial]), [partial]);
  const deleted = item({ status: "deleted", urls: [] });
  assert.deepEqual(reconcileCreationSnapshot([old], [deleted]), [deleted]);
});

test("snapshot joins pre-task optimistic output by run and index without dropping concurrent work or older pages", () => {
  const local = item({ id: "local", optimistic: true, parameters: { runId: "run", outputIndex: 0 } });
  const saved = item({ id: "saved", taskId: "task", parameters: { runId: "run", outputIndex: 0 } });
  const sibling = item({ id: "sibling", optimistic: true, parameters: { runId: "run", outputIndex: 1 } });
  const older = item({ id: "older", createdAt: "2025-01-01T00:00:00.000Z" });
  assert.deepEqual(reconcileCreationSnapshot([local, sibling, older], [saved], 1), [saved, sibling, older]);
});

test("complete snapshots remove remotely deleted rows but retain newly submitted local work", () => {
  const stored = item({ status: "success", urls: ["removed"] });
  const local = item({ id: "local", optimistic: true, status: "generating" });
  assert.deepEqual(reconcileCreationSnapshot([stored, local], []), [local]);
});

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

test("regeneration reuses saved inputs instead of generated outputs", () => {
  const video = item({
    type: "video",
    status: "success",
    urls: ["https://blob.example/generated.mp4"],
    inputUrls: ["https://blob.example/original.png"],
  });

  assert.equal(
    getRegenerationInputImage(video),
    "https://blob.example/original.png"
  );
  assert.notEqual(getRegenerationInputImage(video), video.urls[0]);
});

test("regeneration does not treat legacy video output as an input image", () => {
  const legacyVideo = item({
    type: "video",
    status: "success",
    urls: ["https://blob.example/generated.mp4"],
    inputUrls: [],
  });

  assert.equal(getRegenerationInputImage(legacyVideo), undefined);
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
      processingDurationMs: undefined,
      audio: undefined,
      mode: undefined,
    }
  );
});

test("normalizeGenerationParameters preserves workspace run metadata", () => {
  assert.deepEqual(
    normalizeGenerationParameters({
      model: "GPT Image 2",
      runId: "run-123",
      outputIndex: 2,
      outputCount: 4,
      hiddenFromRecent: true,
    }),
    {
      model: "GPT Image 2",
      resolution: undefined,
      aspectRatio: undefined,
      duration: undefined,
      processingDurationMs: undefined,
      audio: undefined,
      mode: undefined,
      runId: "run-123",
      outputIndex: 2,
      outputCount: 4,
      hiddenFromRecent: true,
    }
  );
});

test("normalizeGenerationParameters keeps a valid processing duration", () => {
  assert.equal(
    normalizeGenerationParameters({ processingDurationMs: 84_321.4 })
      ?.processingDurationMs,
    84_321
  );
  assert.equal(
    normalizeGenerationParameters({ processingDurationMs: -1 }),
    undefined
  );
});

test("formatProcessingDuration uses compact English time units", () => {
  assert.equal(formatProcessingDuration(999), "0s");
  assert.equal(formatProcessingDuration(84_321), "1m 24s");
  assert.equal(formatProcessingDuration(3_664_000), "1h 1m 4s");
});

test("remove-from-recent targets persisted tasks and their shared run", () => {
  assert.deepEqual(
    getCreationRunRemovalTarget(item({
      id: "db-1",
      taskId: "task-1",
      parameters: { runId: "run-1" },
    })),
    { id: "task-1", runId: "run-1" }
  );
});

test("remove-from-recent can target a local failed run before task id recovery", () => {
  assert.deepEqual(
    getCreationRunRemovalTarget(item({
      id: "run-2-0",
      status: "failed",
      parameters: { runId: "run-2" },
    })),
    { id: "run-2-0", runId: "run-2" }
  );
});

test("timeline key changes for new outputs but not media deletion", () => {
  const original = item({
    id: "db-1",
    taskId: "task-1",
    status: "success",
    urls: ["https://blob.example/image.png"],
    parameters: { runId: "run-1", outputIndex: 0 },
  });
  const deleted = { ...original, status: "deleted" as const, urls: [] };
  const nextOutput = item({
    id: "db-2",
    parameters: { runId: "run-2", outputIndex: 0 },
  });

  assert.equal(
    getCreationTimelineKey([original]),
    getCreationTimelineKey([deleted])
  );
  assert.notEqual(
    getCreationTimelineKey([original]),
    getCreationTimelineKey([original, nextOutput])
  );
});

test("conversation timestamps start a stream and repeat after an hour or a day change", () => {
  const first = new Date(2026, 7, 20, 8, 27);
  const beforeHour = new Date(2026, 7, 20, 9, 26, 59);
  const afterHour = new Date(2026, 7, 20, 9, 27);
  const beforeMidnight = new Date(2026, 7, 20, 23, 55);
  const afterMidnight = new Date(2026, 7, 21, 0, 5);

  assert.equal(shouldShowConversationTimestamp(first.toISOString()), true);
  assert.equal(
    shouldShowConversationTimestamp(
      beforeHour.toISOString(),
      first.toISOString()
    ),
    false
  );
  assert.equal(
    shouldShowConversationTimestamp(
      afterHour.toISOString(),
      first.toISOString()
    ),
    true
  );
  assert.equal(
    shouldShowConversationTimestamp(
      afterMidnight.toISOString(),
      beforeMidnight.toISOString()
    ),
    true
  );
});

test("conversation timestamps use Today, Yesterday, and calendar dates", () => {
  const now = new Date(2026, 7, 20, 12, 0);
  const today = new Date(2026, 7, 20, 8, 27).toISOString();
  const yesterday = new Date(2026, 7, 19, 9, 49).toISOString();
  const older = new Date(2026, 7, 18, 10, 5).toISOString();
  assert.match(formatConversationTimestamp(today, now), /^Today /);
  assert.match(formatConversationTimestamp(yesterday, now), /^Yesterday /);
  assert.match(formatConversationTimestamp(older, now), /^Aug 18, /);
});
