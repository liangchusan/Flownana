import { mp4Reader, MAX_MP4_TIMING_ENTRIES } from "./mp4-atoms.ts";
/** Read video-track geometry and average frame rate from bounded MP4/MOV atoms. */
export function movieVideoMetadata(bytes: Uint8Array) {
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const { atoms, find } = mp4Reader(data);
  const child = (parent: { body: number; end: number }, name: string) => find(parent.body, parent.end, name);
  const moov = find(0, data.length, "moov");
  if (!moov) throw new Error("Could not read the video track.");
  for (const track of atoms(moov.body, moov.end)) {
    if (track.type !== "trak") continue;
    const mdia = child(track, "mdia"), tkhd = child(track, "tkhd");
    if (!mdia || !tkhd) continue;
    const hdlr = child(mdia, "hdlr"), mdhd = child(mdia, "mdhd");
    if (!hdlr || hdlr.body + 12 > hdlr.end || data.toString("ascii", hdlr.body + 8, hdlr.body + 12) !== "vide" || !mdhd) continue;
    const minf = child(mdia, "minf"), stbl = minf && child(minf, "stbl");
    const stts = stbl && child(stbl, "stts"), stsd = stbl && child(stbl, "stsd");
    const version = data[tkhd.body];
    if (version !== 0 && version !== 1) throw new Error("Unsupported video header.");
    const sizeOffset = tkhd.body + (version === 1 ? 88 : 76);
    if (sizeOffset + 8 > tkhd.end) throw new Error("Invalid video dimensions.");
    const width = data.readUInt32BE(sizeOffset) / 65536, height = data.readUInt32BE(sizeOffset + 4) / 65536;
    const scaleOffset = mdhd.body + (data[mdhd.body] === 1 ? 20 : 12);
    if (scaleOffset + 4 > mdhd.end) throw new Error("Invalid video timescale.");
    const scale = data.readUInt32BE(scaleOffset);
    let samples = 0, units = 0;
    if (stts && stts.body + 8 <= stts.end) {
      const count = data.readUInt32BE(stts.body + 4);
      if (count > MAX_MP4_TIMING_ENTRIES || stts.body + 8 + count * 8 > stts.end) throw new Error("Invalid frame timing.");
      for (let index = 0; index < count; index++) {
        const offset = stts.body + 8 + index * 8, amount = data.readUInt32BE(offset);
        samples += amount; units += amount * data.readUInt32BE(offset + 4);
      }
    }
    const frameRate = units > 0 && scale > 0 ? samples * scale / units : undefined;
    const codec = stsd && stsd.body + 16 <= stsd.end ? data.toString("ascii", stsd.body + 12, stsd.body + 16) : undefined;
    if (!width || !height || !Number.isFinite(width * height)) throw new Error("Could not read video dimensions.");
    return { width, height, ...(frameRate ? { frameRate } : {}), ...(codec ? { codec } : {}) };
  }
  throw new Error("Could not read the video track. Export as MP4 or MOV and retry.");
}
