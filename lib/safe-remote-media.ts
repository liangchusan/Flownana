import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import ipaddr from "ipaddr.js";

export type RemoteMediaKind = "image" | "video" | "music";

const MIME_TYPES: Record<RemoteMediaKind, Set<string>> = {
  image: new Set([
    "image/avif",
    "image/gif",
    "image/heic",
    "image/heif",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  video: new Set(["video/mp4", "video/quicktime", "video/webm"]),
  music: new Set([
    "audio/mp4",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
  ]),
};

const MAX_REDIRECTS = 3;

function normalizedAddressRange(address: string) {
  const parsed = ipaddr.parse(address);
  const normalized =
    parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()
      ? (parsed as ipaddr.IPv6).toIPv4Address()
      : parsed;
  return normalized.range();
}

export function isPublicNetworkAddress(address: string) {
  try {
    return normalizedAddressRange(address) === "unicast";
  } catch {
    return false;
  }
}

async function resolvePublicAddress(hostname: string) {
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await lookup(hostname, { all: true, verbatim: true });

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicNetworkAddress(address))
  ) {
    throw new Error("Remote media host does not resolve exclusively to public addresses.");
  }

  return addresses[0];
}

function validateRemoteUrl(value: string, previous?: URL) {
  const url = new URL(value, previous);
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password
  ) {
    throw new Error("Remote media URL must use HTTPS on the standard port.");
  }
  if (previous?.protocol === "https:" && url.protocol !== "https:") {
    throw new Error("Remote media redirects may not downgrade HTTPS.");
  }
  return url;
}

function isExpectedMagic(kind: RemoteMediaKind, bytes: Uint8Array) {
  const ascii = Buffer.from(bytes).toString("ascii");
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isGif = ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a");
  const isWebp = ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  const isIsoMedia = ascii.slice(4, 8) === "ftyp";
  const isWebm = Buffer.from(bytes.subarray(0, 4)).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  const isWave = ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE";
  const isMp3 = ascii.startsWith("ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);

  if (kind === "image") return isJpeg || isPng || isGif || isWebp || isIsoMedia;
  if (kind === "video") return isIsoMedia || isWebm;
  return isMp3 || isWave || isIsoMedia;
}

function createValidatedBody(params: {
  response: import("node:http").IncomingMessage;
  kind: RemoteMediaKind;
  maxBytes: number;
  timeoutMs: number;
}) {
  const source = Readable.toWeb(params.response) as ReadableStream<Uint8Array>;
  let received = 0;
  let prefix = Buffer.alloc(0);
  let validated = false;
  const totalTimer = setTimeout(() => {
    params.response.destroy(new Error("Remote media download timed out."));
  }, params.timeoutMs);
  params.response.once("close", () => clearTimeout(totalTimer));

  return source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > params.maxBytes) {
          params.response.destroy();
          controller.error(new Error("Remote media exceeds the maximum size."));
          return;
        }

        if (!validated) {
          prefix = Buffer.concat([prefix, Buffer.from(chunk)]);
          if (prefix.byteLength < 16) return;
          if (!isExpectedMagic(params.kind, prefix)) {
            params.response.destroy();
            controller.error(new Error("Remote media signature does not match its type."));
            return;
          }
          validated = true;
          controller.enqueue(prefix);
          prefix = Buffer.alloc(0);
          return;
        }
        controller.enqueue(chunk);
      },
      flush(controller) {
        clearTimeout(totalTimer);
        if (!validated) {
          if (!isExpectedMagic(params.kind, prefix)) {
            controller.error(new Error("Remote media signature does not match its type."));
            return;
          }
          controller.enqueue(prefix);
        }
      },
    })
  );
}

export async function safeRemoteMediaFetch(params: {
  url: string;
  kind: RemoteMediaKind;
  maxBytes: number;
  timeoutMs?: number;
}): Promise<{
  body: ReadableStream<Uint8Array>;
  contentType: string;
  sizeBytes?: number;
  url: string;
}> {
  const timeoutMs = params.timeoutMs ?? 60_000;
  let current = validateRemoteUrl(params.url);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const resolved = await resolvePublicAddress(current.hostname);
    const response = await new Promise<import("node:http").IncomingMessage>(
      (resolve, reject) => {
        const req = request(
          current,
          {
            method: "GET",
            headers: { accept: "image/*,video/*,audio/*" },
            lookup: (_hostname, _options, callback) =>
              callback(null, resolved.address, resolved.family),
          },
          resolve
        );
        req.setTimeout(Math.min(timeoutMs, 15_000), () => {
          req.destroy(new Error("Remote media connection timed out."));
        });
        req.once("error", reject);
        req.end();
      }
    );

    const status = response.statusCode ?? 0;
    if (status >= 300 && status < 400) {
      const location = response.headers.location;
      response.destroy();
      if (!location || redirect === MAX_REDIRECTS) {
        throw new Error("Remote media redirect limit exceeded.");
      }
      current = validateRemoteUrl(location, current);
      continue;
    }
    if (status < 200 || status >= 300) {
      response.destroy();
      throw new Error(`Failed to download remote media: ${status}`);
    }

    const contentType = String(response.headers["content-type"] || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!MIME_TYPES[params.kind].has(contentType)) {
      response.destroy();
      throw new Error(`Unsupported remote ${params.kind} content type.`);
    }
    const contentLength = Number(response.headers["content-length"] || 0);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      response.destroy();
      throw new Error("Remote media content length is invalid.");
    }
    if (contentLength > params.maxBytes) {
      response.destroy();
      throw new Error("Remote media exceeds the maximum size.");
    }

    return {
      body: createValidatedBody({
        response,
        kind: params.kind,
        maxBytes: params.maxBytes,
        timeoutMs,
      }),
      contentType,
      sizeBytes: contentLength || undefined,
      url: current.toString(),
    };
  }

  throw new Error("Remote media redirect limit exceeded.");
}
