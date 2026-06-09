import assert from "node:assert/strict";
import test from "node:test";
import { parseKieVideoResult } from "../lib/kie-video-result.ts";

test("parseKieVideoResult handles pending Veo record-info response", () => {
  assert.deepEqual(parseKieVideoResult({ successFlag: 0 }), {
    state: "pending",
  });
});

test("parseKieVideoResult extracts Veo record-info response resultUrls", () => {
  assert.deepEqual(
    parseKieVideoResult({
      successFlag: 1,
      response: {
        resultUrls: ["https://cdn.example/video.mp4"],
      },
    }),
    {
      state: "success",
      url: "https://cdn.example/video.mp4",
    }
  );
});

test("parseKieVideoResult extracts JSON string resultUrls", () => {
  assert.deepEqual(
    parseKieVideoResult({
      successFlag: 1,
      response: {
        resultUrls: JSON.stringify(["https://cdn.example/video.mp4"]),
      },
    }),
    {
      state: "success",
      url: "https://cdn.example/video.mp4",
    }
  );
});

test("parseKieVideoResult handles failed Veo record-info response", () => {
  assert.deepEqual(
    parseKieVideoResult({
      successFlag: 3,
      errorMessage: "Provider failed",
    }),
    {
      state: "failed",
      error: "Provider failed",
    }
  );
});

test("parseKieVideoResult keeps market model status parsing", () => {
  assert.deepEqual(
    parseKieVideoResult({
      status: "completed",
      resultJson: JSON.stringify({
        resultUrls: ["https://cdn.example/market-video.mp4"],
      }),
    }),
    {
      state: "success",
      url: "https://cdn.example/market-video.mp4",
    }
  );
});
