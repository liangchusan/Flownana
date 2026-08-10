import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateYearlyUpgradeCreditCents,
  countRemainingMonths,
} from "../lib/upgrade-proration.ts";

test("remaining yearly months start at next unissued credit month", () => {
  assert.equal(
    countRemainingMonths(
      new Date("2026-10-07T00:00:00.000Z"),
      new Date("2027-08-07T00:00:00.000Z"),
      new Date("2026-09-15T00:00:00.000Z")
    ),
    10
  );
});

test("past credit dates do not create extra proration months", () => {
  assert.equal(
    countRemainingMonths(
      new Date("2026-08-07T00:00:00.000Z"),
      new Date("2026-12-07T00:00:00.000Z"),
      new Date("2026-09-20T00:00:00.000Z")
    ),
    3
  );
});

test("yearly tier upgrade credits unused monthly value", () => {
  assert.equal(
    calculateYearlyUpgradeCreditCents({
      currentYearlyAmountCents: 28800,
      remainingMonths: 8,
      targetAmountCents: 57600,
    }),
    19200
  );
});

test("upgrade credit cannot reduce the first charge below one cent", () => {
  assert.equal(
    calculateYearlyUpgradeCreditCents({
      currentYearlyAmountCents: 57600,
      remainingMonths: 12,
      targetAmountCents: 9600,
    }),
    9599
  );
});
