export type Mp4Atom = { type: string; body: number; end: number };
export const MAX_MP4_ATOMS = 8192;
export const MAX_MP4_TIMING_ENTRIES = 100_000;

/** One budget is shared by every nested lookup; iteration never builds an atom array. */
export function mp4Reader(data: Buffer) {
  let visited = 0;
  function* atoms(start: number, end: number): Generator<Mp4Atom> {
    for (let offset = start; offset + 8 <= end;) {
      if (++visited > MAX_MP4_ATOMS) throw new Error("Video metadata is too complex. Export as MP4 and retry.");
      let size = data.readUInt32BE(offset), header = 8;
      if (size === 1) {
        if (offset + 16 > end) throw new Error("Invalid video header.");
        const extended = data.readBigUInt64BE(offset + 8);
        if (extended > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Invalid video size.");
        size = Number(extended); header = 16;
      } else if (size === 0) size = end - offset;
      if (size < header || size > end - offset) throw new Error("Incomplete video file.");
      yield { type: data.toString("ascii", offset + 4, offset + 8), body: offset + header, end: offset + size };
      offset += size;
    }
  }
  function find(start: number, end: number, type: string) {
    for (const atom of atoms(start, end)) if (atom.type === type) return atom;
  }
  return { atoms, find };
}
