import { parseBuffer } from "music-metadata";
import { mp4Reader } from "./mp4-atoms.ts";
import { validateWaveStructure } from "./wave-validation.ts";

/** MP4/MOV movie duration, including silent videos (audio parsers omit those). */
export function movieDuration(bytes: Uint8Array): number {
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const { atoms } = mp4Reader(data);
  function find(start: number, end: number, nested: boolean): number | undefined {
    for (const { type, body, end: atomEnd } of atoms(start, end)) {
      if (type === "moov" && !nested) { const found = find(body, atomEnd, true); if (found != null) return found; }
      if (type === "mvhd" && nested) {
        const version = data[body];
        if ((version !== 0 && version !== 1) || body + (version === 1 ? 32 : 20) > atomEnd) throw new Error("Invalid movie header.");
        const scale = data.readUInt32BE(body + (version === 1 ? 20 : 12));
        const units = version === 1 ? Number(data.readBigUInt64BE(body + 24)) : data.readUInt32BE(body + 16);
        if (!scale || !units || !Number.isSafeInteger(units) || units === 0xffffffff) throw new Error("Could not read the video duration.");
        return units / scale;
      }
    }
  }
  const duration = find(0, data.length, false);
  if (!duration || !Number.isFinite(duration)) throw new Error("Could not read the video duration. Export as MP4 or MOV and retry.");
  return duration;
}
export async function readMediaDuration(bytes: Uint8Array, kind: "video" | "audio", contentType: string) {
  if (kind === "video") return movieDuration(bytes);
  // Check bytes as well as MIME: alternate audio MIME labels must not bypass RIFF validation.
  validateWaveStructure(bytes, contentType);
  const metadata = await parseBuffer(bytes, { mimeType: contentType, size: bytes.length }, { duration: true, skipCovers: true });
  const duration = metadata.format.duration;
  if (!duration || !Number.isFinite(duration)) throw new Error("Could not read the audio duration.");
  return duration;
}
