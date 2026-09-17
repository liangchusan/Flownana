import { parseBuffer } from "music-metadata";

/** MP4/MOV movie duration, including silent videos (audio parsers omit those). */
export function movieDuration(bytes: Uint8Array): number {
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  function find(start: number, end: number, nested: boolean): number | undefined {
    for (let offset = start; offset + 8 <= end;) {
      let size = data.readUInt32BE(offset), header = 8;
      const type = data.toString("ascii", offset + 4, offset + 8);
      if (size === 1) {
        if (offset + 16 > end) throw new Error("Invalid media header.");
        const extended = data.readBigUInt64BE(offset + 8);
        if (extended > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Invalid media size.");
        size = Number(extended); header = 16;
      } else if (size === 0) size = end - offset;
      if (size < header || offset + size > end) throw new Error("Incomplete media file.");
      const body = offset + header;
      if (type === "moov" && !nested) { const found = find(body, offset + size, true); if (found != null) return found; }
      if (type === "mvhd" && nested) {
        const version = data[body];
        if ((version !== 0 && version !== 1) || body + (version === 1 ? 32 : 20) > offset + size) throw new Error("Invalid movie header.");
        const scale = data.readUInt32BE(body + (version === 1 ? 20 : 12));
        const units = version === 1 ? Number(data.readBigUInt64BE(body + 24)) : data.readUInt32BE(body + 16);
        if (!scale || !units || !Number.isSafeInteger(units) || units === 0xffffffff) throw new Error("Could not read the video duration.");
        return units / scale;
      }
      offset += size;
    }
  }
  const duration = find(0, data.length, false);
  if (!duration || !Number.isFinite(duration)) throw new Error("Could not read the video duration. Export as MP4 or MOV and retry.");
  return duration;
}
export async function readMediaDuration(bytes: Uint8Array, kind: "video" | "audio", contentType: string) {
  if (kind === "video") return movieDuration(bytes);
  const metadata = await parseBuffer(bytes, { mimeType: contentType, size: bytes.length }, { duration: true, skipCovers: true });
  const duration = metadata.format.duration;
  if (!duration || !Number.isFinite(duration)) throw new Error("Could not read the audio duration.");
  return duration;
}
