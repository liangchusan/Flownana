import test from "node:test";
import assert from "node:assert/strict";
import { signupBonusEvidence, normalizeSignupIp, signupCountryEligible } from "../lib/signup-bonus-policy.ts";

const env = { NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production",
  SIGNUP_BONUS_IP_HASH_SECRET: "signup_policy_test_fixture_0123456789" } as NodeJS.ProcessEnv;
const headers = (ip = "8.8.8.8", country = "US") => new Headers({
  "x-vercel-forwarded-for": ip, "x-vercel-ip-country": country,
});

test("signup: exactly seven eligible IP countries, with platform country normalization", () => {
  for (const country of ["US", "JP", "KR", "TW", "DE", "FR", "GB"]) {
    assert.equal(signupCountryEligible(country), true);
    assert.equal(signupBonusEvidence(headers("8.8.8.8", country.toLowerCase()), env).country, country);
  }
  for (const country of [null, "", "CN", "HK", "CA", "AU", "UK", "ZZ"]) assert.equal(signupCountryEligible(country), false);
});

test("signup: canonical IPs merge IPv4-mapped IPv6 and alternate IPv6 spellings", () => {
  assert.equal(normalizeSignupIp("::ffff:8.8.8.8"), "8.8.8.8");
  assert.equal(normalizeSignupIp("2606:4700:0000:0000:0000:0000:0000:1111"), "2606:4700::1111");
  assert.deepEqual(signupBonusEvidence(headers("8.8.8.8"), env), signupBonusEvidence(headers("::ffff:8.8.8.8"), env));
  assert.notEqual(signupBonusEvidence(headers("2606:4700::1111"), env).ipHash,
    signupBonusEvidence(headers("2606:4700::1112"), env).ipHash, "exact IP, not a subnet");
});

test("signup: reject private, local, zoned, abbreviated, chained and malformed client IPs", () => {
  for (const ip of [null, "", "127.0.0.1", "10.0.0.1", "192.168.1.1", "172.16.0.1", "::1",
    "::ffff:127.0.0.1", "fe80::1", "fe80::1%en0", "8.8.8.8, 1.1.1.1", "8.8.8", "0x08080808", "unknown"]) {
    assert.equal(normalizeSignupIp(ip), null, ip ?? "null");
  }
});

test("signup: non-Vercel, local, missing configuration and client fallbacks cannot grant evidence", () => {
  const empty = { ipHash: null, country: null };
  for (const change of [{ VERCEL: "" }, { NODE_ENV: "development" }, { VERCEL_ENV: "development" },
    { SIGNUP_BONUS_IP_HASH_SECRET: "" }, { SIGNUP_BONUS_IP_HASH_SECRET: "short" }]) {
    assert.deepEqual(signupBonusEvidence(headers(), { ...env, ...change }), empty);
  }
  assert.deepEqual(signupBonusEvidence(new Headers({ "x-forwarded-for": "8.8.8.8", "x-real-ip": "8.8.8.8",
    "x-vercel-ip-country": "US", cookie: "country=US; ip=8.8.8.8" }), env), empty);
  const unknown = signupBonusEvidence(headers("8.8.8.8", "USA"), env);
  assert.ok(unknown.ipHash); assert.equal(unknown.country, null);
});

test("signup: IP digests are keyed, stable and do not expose the original address", () => {
  const evidence = signupBonusEvidence(headers(), env);
  assert.match(evidence.ipHash!, /^[a-f0-9]{64}$/);
  assert.equal(evidence.ipHash, signupBonusEvidence(headers(), env).ipHash);
  assert.notEqual(evidence.ipHash, signupBonusEvidence(headers(), { ...env,
    SIGNUP_BONUS_IP_HASH_SECRET: "different_test_fixture_key_0123456789" }).ipHash);
  assert.ok(!JSON.stringify(evidence).includes("8.8.8.8"));
});
