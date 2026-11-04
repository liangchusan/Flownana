import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, chmodSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { movieDuration, readMediaDuration } from "../lib/media-duration.ts";
import { movieVideoMetadata } from "../lib/video-metadata.ts";
import { MAX_MP4_ATOMS } from "../lib/mp4-atoms.ts";
import { readAgentLoginRecovery } from "../lib/agent-login-recovery.ts";
import { createSourceLoader } from "./helpers/load-source.ts";

function atom(type: string, body = Buffer.alloc(0)) { const b = Buffer.alloc(8 + body.length); b.writeUInt32BE(b.length); b.write(type, 4); body.copy(b, 8); return b; }
test("MP4 work budget rejects dense atoms and extended-size aliases without proportional arrays", () => {
  const dense = Buffer.concat(Array.from({ length: MAX_MP4_ATOMS + 1 }, () => atom("free")));
  for (const parse of [movieDuration, movieVideoMetadata]) assert.throws(() => parse(dense), /too complex/);
  const extended = Buffer.alloc(16); extended.writeUInt32BE(1); extended.write("free", 4); extended.writeBigUInt64BE(0xffffffffffffffffn, 8);
  for (const parse of [movieDuration, movieVideoMetadata]) assert.throws(() => parse(extended), /Invalid video size/);
  const header = Buffer.alloc(100); header.writeUInt32BE(1000, 12); header.writeUInt32BE(5000, 16);
  assert.equal(movieDuration(Buffer.concat([atom("moov", atom("mvhd", header)), dense])), 5);
});

function wav(type: string, declared: number, body = Buffer.alloc(0)) {
  const b = Buffer.alloc(20 + body.length); b.write("RIFF"); b.writeUInt32LE(b.length - 8, 4); b.write("WAVE", 8);
  b.write(type, 12); b.writeUInt32LE(declared, 16); body.copy(b, 20); return b;
}
test("tiny WAV declarations, nested INFO and MIME aliases reject before third-party allocation", async () => {
  let parsed = 0;
  const duration = createSourceLoader({ "music-metadata": { parseBuffer: async () => { parsed++; return { format: { duration: 3 } }; } } })<typeof import("../lib/media-duration")>("lib/media-duration.ts");
  for (const type of ["CSET", "fmt ", "fact", "ID3 ", "id3 ", "LIST"]) {
    for (const mime of ["audio/wav", "audio/mpeg"]) await assert.rejects(duration.readMediaDuration(wav(type, 0xfffffff0), "audio", mime), /Incomplete WAV/);
  }
  const info = Buffer.alloc(12); info.write("INFOINAM"); info.writeUInt32LE(0xfffffff0, 8);
  await assert.rejects(duration.readMediaDuration(wav("LIST", info.length, info), "audio", "audio/x-wav"), /Incomplete WAV/);
  await assert.rejects(duration.readMediaDuration(wav("CSET", 1024 * 1024 + 2, Buffer.alloc(1024 * 1024 + 2)), "audio", "audio/wav"), /safe limit/);
  assert.equal(parsed, 0);
  await assert.rejects(readMediaDuration(Buffer.alloc(2), "audio", "audio/wav"));
});

test("image limits run before alpha decoding; every Sharp decoder receives the explicit pixel budget", async () => {
  let alphaReads = 0; const options: any[] = [];
  const load = createSourceLoader({
    "@/lib/safe-remote-media": { safeRemoteMediaFetch: async () => ({ body: Buffer.from("fixture"), contentType: "image/png" }) },
    "./media-inspection-budget": { withMediaInspection: async (_: unknown, run: () => Promise<unknown>) => run() },
    sharp: { __esModule: true, default: (_bytes: unknown, opts: unknown) => { options.push(opts); return {
      metadata: async () => ({ width: 16000, height: 16000, hasAlpha: true }),
      extractChannel: () => { alphaReads++; throw new Error("Must not decode over-budget pixels"); },
    }; } },
  });
  const media = load<any>("lib/inspect-reference.ts");
  await assert.rejects(media.inspectReference("https://media.test/x.png", "image", 1024), /safe limit/);
  assert.equal(alphaReads, 0); assert.deepEqual(options, [{ limitInputPixels: 64_000_000 }]);
});

test("login recovery keeps anonymous and same-account handoffs but discards unscoped and different-account data", () => {
  const draft = { prompt: "PRIVATE_A", inputs: [{ url: "https://media.test/a.png" }] };
  const raw = (sourceScope: string | null) => JSON.stringify({ version: 1, sourceScope, draft });
  assert.deepEqual(readAgentLoginRecovery(raw("A:epoch"), "A:epoch"), draft);
  assert.deepEqual(readAgentLoginRecovery(raw(null), "B:epoch"), draft);
  assert.equal(readAgentLoginRecovery(raw("A:epoch"), "B:epoch"), null);
  assert.equal(readAgentLoginRecovery(raw("A:old"), "A:new"), null);
  assert.equal(readAgentLoginRecovery(JSON.stringify(draft), "B:epoch"), null);
});

test("legacy template analyze returns Gone before service/provider work, preserving authenticated GET", async () => {
  let calls = 0;
  const user = { id: "owner", accountCreatedAt: "2026-10-24T00:00:00.000Z" };
  const { POST } = createSourceLoader({
    "next/server": { NextResponse: { json: Response.json } }, "next-auth": { getServerSession: async () => ({ user }) },
    "@/lib/auth-options": { authOptions: {} }, "@/lib/account-scope": { getAccountScope: () => "owner", ACCOUNT_SCOPE_HEADER: "x-account" },
    "@/lib/image-templates/service": { analyzeTemplateRun: async () => { calls++; }, generateTemplateRun: async () => { calls++; } },
    "@/lib/image-templates/worker": {},
  })<any>("app/api/image-template/route.ts");
  for (let i = 0; i < 3; i++) {
    const reply = await POST(new Request("https://app.test/api/image-template", { method: "POST", headers: { "x-account": "owner" }, body: JSON.stringify({ action: "analyze", id: crypto.randomUUID(), revision: 0, input: {} }) }));
    assert.equal(reply.status, 410);
  }
  assert.equal(calls, 0);
});

test("upload tokens bind one exact path without random suffixes; a reused grant cannot mint another token", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "isolated_upload_fixture";
  const id = crypto.randomUUID(), seen = new Set<string>(); let settings: any;
  const user = { id: "owner", accountCreatedAt: "2026-10-24T00:00:00.000Z" };
  const api = createSourceLoader({
    "next/server": { NextResponse: { json: Response.json } }, "next-auth": { getServerSession: async () => ({ user }) },
    "@/lib/auth-options": { authOptions: {} }, "@/lib/prisma": { prisma: {} },
    "@/lib/upload-reservation": { MediaUploadRateLimitError: class extends Error {}, reserveMediaUpload: async (_: unknown, payload: any) => { if (seen.has(payload.uploadId)) throw new Error("Duplicate grant"); seen.add(payload.uploadId); } },
    "@vercel/blob/client": { handleUpload: async ({ onBeforeGenerateToken }: any) => settings = await onBeforeGenerateToken(`generation-inputs/image/${id}/normal..png`, JSON.stringify({ uploadId: id, kind: "image", sizeBytes: 10 })) },
  })<any>("app/api/creations/upload/route.ts");
  const request = () => new Request("https://app.test/api/creations/upload", { method: "POST", body: "{}" });
  assert.equal((await api.POST(request())).status, 200);
  assert.equal(settings.addRandomSuffix, false); assert.equal(settings.allowOverwrite, false);
  assert.equal((await api.POST(request())).status, 400);
});

test("smoke script writes only a private per-run response and removes temporary data", () => {
  const root = mkdtempSync(join(tmpdir(), "flownana-smoke-test-"));
  try {
    const curl = join(root, "curl"), log = join(root, "writes");
    writeFileSync(curl, '#!/bin/sh\nwhile [ "$#" -gt 0 ]; do if [ "$1" = "-o" ]; then shift; printf "%s\\n" "$1" >> "$SMOKE_LOG"; printf "safe" > "$1"; fi; shift; done\nprintf 500\n'); chmodSync(curl, 0o700);
    const result = spawnSync("bash", ["scripts/smoke-prod.sh"], { cwd: process.cwd(), env: { ...process.env, PATH: `${root}:${process.env.PATH}`, TMPDIR: root, SMOKE_LOG: log }, encoding: "utf8" });
    assert.equal(result.status, 1);
    const paths = readFileSync(log, "utf8").trim().split("\n");
    assert.equal(paths.length, 1); assert.ok(paths[0].startsWith(`${root}/flownana-smoke.`));
    assert.ok(!paths[0].includes("flownana-smoke-response.txt"));
    assert.ok(!readdirSync(root).some(name => name.startsWith("flownana-smoke.")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
