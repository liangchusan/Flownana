const MAX_CHUNKS = 4096;
const MAX_METADATA_BYTES = 1024 * 1024;

/** Guard sized-token allocations (including LIST/INFO subchunks) before music-metadata. */
export function validateWaveStructure(bytes: Uint8Array, contentType: string) {
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = data.toString("ascii", 0, 4) === "RIFF";
  if (!riff && !["audio/wav", "audio/x-wav", "audio/wave"].includes(contentType.split(";")[0].toLowerCase())) return;
  if (!riff || data.length < 12 || data.toString("ascii", 8, 12) !== "WAVE") throw new Error("Invalid WAV header.");
  const end = data.readUInt32LE(4) + 8;
  if (end !== data.length) throw new Error("Incomplete WAV file.");
  let chunks = 0, metadataBytes = 0;
  function scan(start: number, limit: number, depth: number) {
    if (depth > 4) throw new Error("WAV metadata is too complex.");
    for (let offset = start; offset < limit;) {
      if (++chunks > MAX_CHUNKS || limit - offset < 8) throw new Error("Invalid WAV chunk.");
      const type = data.toString("ascii", offset, offset + 4), size = data.readUInt32LE(offset + 4);
      const body = offset + 8, next = body + size + (size % 2);
      if (size > limit - body || next > limit) throw new Error("Incomplete WAV chunk.");
      if (type !== "data") {
        // Count container metadata once; bound every leaf token before allocation.
        if (size > MAX_METADATA_BYTES) throw new Error("WAV metadata exceeds the safe limit.");
        if (type === "LIST" || type === "RIFF") {
          if (size < 4) throw new Error("Invalid WAV list.");
          scan(body + 4, body + size, depth + 1);
        } else {
          metadataBytes += size;
          if (metadataBytes > MAX_METADATA_BYTES) throw new Error("WAV metadata exceeds the safe limit.");
          if ((type === "fmt " && size < 16) || (type === "fact" && size < 4) || (type === "CSET" && size < 8)) throw new Error("Invalid WAV metadata.");
        }
      }
      offset = next;
    }
  }
  scan(12, end, 0);
}
