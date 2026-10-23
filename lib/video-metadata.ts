/** Read video-track geometry and average frame rate from bounded MP4/MOV atoms. */
export function movieVideoMetadata(bytes: Uint8Array) {
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  type Atom = { type: string; body: number; end: number };
  function atoms(start: number, end: number): Atom[] {
    const result: Atom[] = [];
    for (let offset = start; offset + 8 <= end;) {
      let size = data.readUInt32BE(offset), header = 8;
      if (size === 1) {
        if (offset + 16 > end) throw new Error("Invalid video header.");
        const extended = data.readBigUInt64BE(offset + 8);
        if (extended > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Invalid video size.");
        size = Number(extended); header = 16;
      } else if (size === 0) size = end - offset;
      if (size < header || offset + size > end) throw new Error("Incomplete video file.");
      result.push({ type: data.toString("ascii", offset + 4, offset + 8), body: offset + header, end: offset + size });
      offset += size;
    }
    return result;
  }
  const child = (parent: Atom, name: string) => atoms(parent.body, parent.end).find(atom => atom.type === name);
  const moov = atoms(0, data.length).find(atom => atom.type === "moov");
  if (!moov) throw new Error("Could not read the video track.");
  for (const track of atoms(moov.body, moov.end).filter(atom => atom.type === "trak")) {
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
      if (stts.body + 8 + count * 8 > stts.end) throw new Error("Invalid frame timing.");
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
