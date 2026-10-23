import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { movieVideoMetadata } from "../lib/video-metadata.ts";
import { getVideoInputCapabilities } from "../lib/generation-input-capabilities.ts";
import { referenceIssue } from "../lib/reference-validation.ts";
import { createSourceLoader } from "./helpers/load-source.ts";
function atom(type: string, body: Buffer) { const out = Buffer.alloc(body.length + 8); out.writeUInt32BE(out.length); out.write(type, 4); body.copy(out, 8); return out; }
function movie(width: number, height: number, frameRate = 30) {
  const tkhd = Buffer.alloc(84); tkhd.writeUInt32BE(width * 65536, 76); tkhd.writeUInt32BE(height * 65536, 80);
  const hdlr = Buffer.alloc(12); hdlr.write("vide", 8);
  const mdhd = Buffer.alloc(24); mdhd.writeUInt32BE(frameRate * 100, 12);
  const stts = Buffer.alloc(16); stts.writeUInt32BE(1, 4); stts.writeUInt32BE(300, 8); stts.writeUInt32BE(100, 12);
  const stsd = Buffer.alloc(16); stsd.write("avc1", 12);
  return atom("moov", atom("trak", Buffer.concat([atom("tkhd", tkhd), atom("mdia", Buffer.concat([atom("hdlr", hdlr), atom("mdhd", mdhd), atom("minf", atom("stbl", Buffer.concat([atom("stts", stts), atom("stsd", stsd)])))]))])));
}
test("actual MP4 track dimensions, codec and frame timing are parsed without trusting the browser", () => {
  assert.deepEqual(movieVideoMetadata(movie(640, 640)), { width: 640, height: 640, frameRate: 30, codec: "avc1" });
  for (const bytes of [Buffer.alloc(0), movie(640, 640).subarray(0, 20), movie(0, 640)]) assert.throws(() => movieVideoMetadata(bytes));
});
test("Seedance video geometry and pixel/FPS constraints are enforced at exact boundaries", () => {
  const caps = getVideoInputCapabilities("Seedance 2.0 Mini");
  const ref = { kind: "video" as const, contentType: "video/mp4", sizeBytes: 1024, durationSeconds: 5, ...movieVideoMetadata(movie(640, 640)) };
  assert.equal(referenceIssue(caps, ref), undefined);
  assert.match(referenceIssue(caps, { ...ref, width: 639 })!, /pixel count/);
  assert.match(referenceIssue(caps, { ...ref, frameRate: 23 })!, /frame rate/);
  assert.match(referenceIssue(caps, { ...ref, width: 100 })!, /dimensions/);
  assert.equal(referenceIssue(caps, { ...ref, frameRate: 24 }), undefined);
  assert.equal(referenceIssue(caps, { ...ref, frameRate: 60 }), undefined);
});
test("image inspection reads actual decoded geometry and rejects corrupt reference bytes", async () => {
  const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: "white" } }).png().toBuffer();
  const load = createSourceLoader({ "@/lib/safe-remote-media": { safeRemoteMediaFetch: async () => ({ body: png, contentType: "image/png" }) } });
  const { inspectReference } = load<any>("lib/inspect-reference.ts");
  const metadata = await inspectReference("https://media.test/img.png", "image", 1024 ** 2);
  assert.equal(metadata.width, 800); assert.equal(metadata.height, 600);
  assert.equal(referenceIssue(getVideoInputCapabilities("MiniMax H3 (Hailuo-03)"), metadata), undefined);
  const bad = createSourceLoader({ "@/lib/safe-remote-media": { safeRemoteMediaFetch: async () => ({ body: Buffer.from("invalid"), contentType: "image/png" }) } });
  await assert.rejects(bad<any>("lib/inspect-reference.ts").inspectReference("https://media.test/bad.png", "image", 1024));
});

test("Wan rejects actual transparency while preserving ordinary opaque PNGs", async () => {
  for (const alpha of [0, 1]) {
    const png = await sharp({ create: { width: 300, height: 300, channels: 4, background: { r: 255, g: 255, b: 255, alpha } } }).png().toBuffer();
    const load = createSourceLoader({ "@/lib/safe-remote-media": { safeRemoteMediaFetch: async () => ({ body: png, contentType: "image/png" }) } });
    const metadata = await load<any>("lib/inspect-reference.ts").inspectReference("https://media.test/img.png", "image", 1024 ** 2);
    assert.equal(metadata.hasTransparency, alpha === 0);
    assert.equal(!!referenceIssue(getVideoInputCapabilities("Wan 3.0 Video"), metadata), alpha === 0);
  }
});
