import assert from "node:assert/strict";
import test from "node:test";
import {
  getTestAuthCreditAmount,
  isServerTestAuthEnabled,
} from "../lib/test-auth-config.ts";

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

test("test login is always disabled on a Vercel production deployment", () => {
  assert.equal(
    isServerTestAuthEnabled({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      ENABLE_TEST_AUTH: "true",
    }),
    false
  );
  assert.equal(
    isServerTestAuthEnabled({
      NODE_ENV: "development",
      VERCEL_ENV: "production",
      ENABLE_TEST_AUTH: "true",
    }),
    false
  );
});

test("test login can be explicitly enabled for a production-mode preview", () => {
  assert.equal(
    isServerTestAuthEnabled({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      ENABLE_TEST_AUTH: "true",
    }),
    true
  );
});
