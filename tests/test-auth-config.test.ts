import assert from "node:assert/strict";
import test from "node:test";
import { getTestAuthCreditAmount } from "../lib/test-auth-config.ts";

test("test login credits default to zero outside local development", () => {
  assert.equal(getTestAuthCreditAmount({ NODE_ENV: "production" }), 0);
});

test("local development keeps the existing 1000-credit convenience grant", () => {
  assert.equal(getTestAuthCreditAmount({ NODE_ENV: "development" }), 1000);
});

test("an explicit preview credit setting wins, including zero", () => {
  assert.equal(
    getTestAuthCreditAmount({
      NODE_ENV: "production",
      TEST_AUTH_CREDITS: "0",
    }),
    0
  );
});
