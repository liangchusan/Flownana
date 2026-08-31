import assert from "node:assert/strict";
import test from "node:test";
import { matchesRequestAccount } from "../lib/account-scope.ts";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { refreshAccountToken, sessionAccountWhere } from "../lib/account-session.ts";

const account = { id: "google-user", createdAt: new Date("2026-08-01T00:00:00Z"),
  name: "Saved name", email: "user@example.test", image: "https://example.test/avatar.png" };
const token = { id: account.id, accountCreatedAt: account.createdAt.toISOString() };

test("existing account sessions and fresh sign-ins use persisted profile", async () => {
  const existing = await refreshAccountToken({ token: { ...token, name: "Untrusted", picture: "other" },
    findAccount: async () => account });
  assert.equal(existing.name, account.name);
  assert.equal(existing.picture, account.image);
  const fresh = await refreshAccountToken({ token: {},
    authenticatedUser: { id: account.id, accountCreatedAt: token.accountCreatedAt },
    findAccount: async () => account });
  assert.equal(fresh.id, token.id);
  assert.equal(fresh.accountCreatedAt, token.accountCreatedAt);
});

test("deleted, recreated and legacy accounts cannot reuse a previous session", async () => {
  await assert.rejects(refreshAccountToken({ token, findAccount: async () => null }), /Session revoked/);
  await assert.rejects(refreshAccountToken({ token, findAccount: async () => ({ ...account,
    createdAt: new Date("2026-08-02T00:00:00Z") }) }), /Session revoked/);
  for (const legacy of [{ id: account.id }, { sub: account.id }, { ...token, accountCreatedAt: 0 }]) {
    await assert.rejects(refreshAccountToken({ token: legacy, findAccount: async () => account }), /Session revoked/);
  }
});

test("deleted account between OAuth verification and token issuance fails closed", async () => {
  await assert.rejects(refreshAccountToken({ token: {},
    authenticatedUser: { id: account.id, accountCreatedAt: token.accountCreatedAt },
    findAccount: async () => ({ ...account, createdAt: new Date("2026-08-02T00:00:00Z") }) }), /Session revoked/);
});

test("database lookup failure cannot fall back to cached identity", async () => {
  await assert.rejects(refreshAccountToken({ token, findAccount: async () => { throw new Error("offline"); } }), /offline/);
});

test("an already authenticated profile request cannot update a re-registered account", async () => {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  let saved = { ...account };
  const session = { user: { id: account.id, accountCreatedAt: token.accountCreatedAt, email: account.email } };
  const source = readFileSync(new URL("../app/api/account/profile/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const routeModule = { exports: {} as { PATCH: (request: { headers: Headers; json: () => Promise<unknown> }) => Promise<Response> } };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse: { json: Response.json } },
    "next-auth": { getServerSession: async () => session },
    "@/lib/auth-options": { authOptions: {} },
    "@/lib/account-session": { sessionAccountWhere },
    "@/lib/account-scope": { matchesRequestAccount },
    "@/lib/prisma": { prisma: { user: { update: async (args: {
      where: { id: string; createdAt?: Date }; data: { name: string };
    }) => {
      if (args.where.id !== saved.id || (args.where.createdAt &&
        args.where.createdAt.getTime() !== saved.createdAt.getTime())) {
        throw new Error("Account no longer exists");
      }
      saved = { ...saved, ...args.data };
      return saved;
    } } } },
  };
  new Function("require", "module", "exports", compiled)((name: string) => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  }, routeModule, routeModule.exports);
  await assert.rejects(routeModule.exports.PATCH({ headers: new Headers(), json: async () => {
    // The old identity has passed authentication, but deletion and fresh signup
    // finish before the body arrives. Prisma's final predicate must reject it.
    saved = { ...account, createdAt: new Date("2026-08-02T00:00:00Z") };
    return { name: "old request" };
  } }), /Account no longer exists/);
  assert.equal(saved.name, account.name);
  assert.equal(sessionAccountWhere(session.user).createdAt.getTime(), account.createdAt.getTime());
});

test("installed NextAuth clears invalid cookies and returns no authenticated session", async () => {
  const require = createRequire(import.meta.url);
  // Exercise the installed v4 session route, not an assumed v5 null-token contract.
  const { default: sessionRoute } = require("../node_modules/next-auth/core/routes/session.js");
  for (const existing of [null, { ...account, createdAt: new Date("2026-08-02T00:00:00Z") }, account]) {
    let encoded = 0;
    let exposed = 0;
    const response = await sessionRoute({
      options: {
        session: { strategy: "jwt", maxAge: 60 },
        jwt: { decode: async () => token, encode: async () => { encoded++; return "new-cookie"; } },
        callbacks: {
          jwt: (args: { token: typeof token }) => refreshAccountToken({ token: args.token, findAccount: async () => existing }),
          session: async ({ token: claims }: { token: typeof token }) => { exposed++; return { user: { id: claims.id } }; },
        },
        logger: { error: () => {} }, events: {},
      },
      sessionStore: { value: "signed-token", clean: () => [{ name: "session", value: "" }], chunk: () => [] },
      isUpdate: true,
      newSession: { user: { id: "another-user", accountCreatedAt: "2026-08-02T00:00:00.000Z" } },
    });
    if (existing === account) {
      assert.equal(response.body.user.id, account.id);
      assert.equal(encoded, 1);
      assert.equal(exposed, 1);
    } else {
      assert.deepEqual(response.body, {});
      assert.deepEqual(response.cookies, [{ name: "session", value: "" }]);
      assert.equal(encoded, 0);
      assert.equal(exposed, 0);
    }
  }
});
