import test from "node:test";
import assert from "node:assert/strict";
import { movieDuration, readMediaDuration } from "../lib/media-duration.ts";
function atom(type: string, bytes: Buffer) { const out = Buffer.alloc(bytes.length + 8); out.writeUInt32BE(out.length); out.write(type, 4); bytes.copy(out, 8); return out; }
function movie(version: number, duration: number) { const header = Buffer.alloc(100); header[0] = version; header.writeUInt32BE(1000, version ? 20 : 12); if (version) header.writeBigUInt64BE(BigInt(duration), 24); else header.writeUInt32BE(duration, 16); return atom("moov", atom("mvhd", header)); }
test("silent MP4/MOV duration uses the movie header, including version 1", async () => {
  for (const version of [0, 1]) {
    const bytes = Buffer.concat([atom("ftyp", Buffer.from("isom0000")), atom("mdat", Buffer.alloc(32)), movie(version, 15001)]);
    assert.equal(movieDuration(bytes), 15.001);
    assert.equal(await readMediaDuration(bytes, "video", "video/mp4"), 15.001);
  }
});
test("empty, truncated, zero-length and malicious movie headers cannot pass checks", () => {
  for (const bytes of [Buffer.alloc(0), movie(0, 0), movie(0, 3).subarray(0, 12), Buffer.from([255,255,255,255,109,111,111,118])]) assert.throws(() => movieDuration(bytes));
});
test("actual PCM WAV data has a measured duration", async () => {
  const sampleRate = 8000, count = sampleRate * 3;
  const wav = Buffer.alloc(44 + count * 2);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(count * 2, 40);
  assert.equal(await readMediaDuration(wav, "audio", "audio/wav"), 3);
});
