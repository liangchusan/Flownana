import assert from "node:assert/strict";
import test from "node:test";
import { ACCOUNT_SCOPE_HEADER, getAccountScope, matchesRequestAccount } from "../lib/account-scope.ts";

test("client account scope requires a canonical registration epoch and distinguishes recreated accounts", () => {
  const account = { id: "fixture", accountCreatedAt: "2026-08-31T00:00:00.000Z" };
  assert.ok(getAccountScope(account));
  assert.notEqual(getAccountScope(account), getAccountScope({ ...account, accountCreatedAt: "2026-08-31T01:00:00.000Z" }));
  assert.equal(getAccountScope({ id: "fixture" }), null);
  assert.equal(getAccountScope({ ...account, accountCreatedAt: "not-a-date" }), null);
  assert.equal(getAccountScope({ ...account, accountCreatedAt: "2026-08-31" }), null);
  assert.equal(getAccountScope(null), null);
});

test("a stale client scope cannot authorize a request under a different account cookie", () => {
  const account = { id: "fixture", accountCreatedAt: "2026-08-31T00:00:00.000Z" };
  const request = new Request("http://localhost/api/generate", { headers: { [ACCOUNT_SCOPE_HEADER]: getAccountScope(account)! } });
  assert.equal(matchesRequestAccount(request, account), true);
  assert.equal(matchesRequestAccount(request, { ...account, id: "other" }), false);
  assert.equal(matchesRequestAccount(request, { ...account, accountCreatedAt: "2026-08-31T01:00:00.000Z" }), false);
  assert.equal(matchesRequestAccount(new Request(request.url), account), true);
});
