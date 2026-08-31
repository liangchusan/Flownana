import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

/** Opt-in only: never load .env, connect remotely, or accept a business DB. */
export function isolatedTestDatabase(url: string) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, "postgresql:");
  assert.equal(parsed.hostname, "localhost");
  assert.match(parsed.pathname, /^\/flownana_[a-z_]*test$/);
  assert.match(parsed.searchParams.get("host") ?? "", /^\/private\/tmp\/fnpg\.[A-Za-z0-9]+$/);
  return new PrismaClient({ datasources: { db: { url } } });
}
