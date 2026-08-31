import assert from "node:assert/strict";
import test from "node:test";
import {
  addMonthsClamped,
  getDueYearlyCreditGrantDates,
  getNextYearlyCreditAt,
  getYearlyCreditGrantKey,
} from "../lib/yearly-credit-schedule.ts";

test("addMonthsClamped handles short months", () => {
  assert.equal(
    addMonthsClamped(new Date("2026-01-31T00:00:00.000Z"), 1).toISOString(),
    "2026-02-28T00:00:00.000Z"
  );
});

test("getDueYearlyCreditGrantDates catches up all overdue months", () => {
  const dates = getDueYearlyCreditGrantDates({
    nextCreditAt: new Date("2026-05-08T07:36:12.000Z"),
    currentPeriodStart: new Date("2026-04-08T07:36:12.000Z"),
    now: new Date("2026-07-09T00:00:00.000Z"),
    currentPeriodEnd: new Date("2027-04-08T07:35:41.000Z"),
  });

  assert.deepEqual(
    dates.map((date) => date.toISOString()),
    [
      "2026-05-08T07:36:12.000Z",
      "2026-06-08T07:36:12.000Z",
      "2026-07-08T07:36:12.000Z",
    ]
  );
});

test("getNextYearlyCreditAt returns null once period is exhausted", () => {
  assert.equal(
    getNextYearlyCreditAt({
      lastDueCreditAt: new Date("2027-03-08T07:36:12.000Z"),
      currentPeriodStart: new Date("2026-04-08T07:36:12.000Z"),
      currentPeriodEnd: new Date("2027-04-08T07:35:41.000Z"),
    }),
    null
  );
});

test("every annual calendar anchor has exactly eleven follow-up grants", () => {
  for (const year of [2023, 2024, 2025, 2026]) {
    for (let month = 0; month < 12; month += 1) {
      for (let day = 1; day <= 31; day += 1) {
        const start = new Date(Date.UTC(year, month, day, 12, 34, 56));
        if (start.getUTCMonth() !== month) continue;
        const end = addMonthsClamped(start, 12);
        const dates = getDueYearlyCreditGrantDates({
          currentPeriodStart: start, currentPeriodEnd: end,
          nextCreditAt: addMonthsClamped(start, 1), now: end,
        });
        assert.equal(dates.length, 11, start.toISOString());
        dates.forEach((date, index) => {
          assert.equal(date.getTime(), addMonthsClamped(start, index + 1).getTime());
          assert.equal(getNextYearlyCreditAt({ currentPeriodStart: start,
            currentPeriodEnd: end, lastDueCreditAt: date })?.getTime() ?? null,
          dates[index + 1]?.getTime() ?? null);
        });
      }
    }
  }
});

test("legacy month-end drift keeps the unissued month without replay or extra batch", () => {
  const period = { currentPeriodStart: new Date("2026-01-31T12:00:00Z"),
    currentPeriodEnd: new Date("2027-01-31T12:00:00Z"), now: new Date("2027-01-31T12:00:00Z") };
  const dates = getDueYearlyCreditGrantDates({ ...period, nextCreditAt: new Date("2026-03-28T12:00:00Z") });
  assert.equal(dates.length, 10);
  assert.equal(dates[0].toISOString(), "2026-03-31T12:00:00.000Z");
  assert.equal(dates[9].toISOString(), "2026-12-31T12:00:00.000Z");
  assert.deepEqual(getDueYearlyCreditGrantDates({ ...period,
    nextCreditAt: new Date("2027-01-28T12:00:00Z") }), []);
  assert.deepEqual(getDueYearlyCreditGrantDates({ ...period,
    nextCreditAt: new Date("2025-12-28T12:00:00Z") }), []);
});

test("short-month clamping preserves UTC time across DST", () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ["UTC", "America/New_York", "Pacific/Auckland"]) {
      process.env.TZ = timezone;
      assert.equal(addMonthsClamped(new Date("2026-03-01T01:30:00Z"), 1).toISOString(),
        "2026-04-01T01:30:00.000Z");
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("legacy local-time pointers retain their allocation even in the same UTC month", () => {
  const dates = getDueYearlyCreditGrantDates({
    currentPeriodStart: new Date("2026-03-01T00:30:00Z"),
    currentPeriodEnd: new Date("2027-03-01T00:30:00Z"),
    nextCreditAt: new Date("2026-03-28T23:30:00Z"),
    now: new Date("2027-03-01T00:30:00Z"),
  });
  assert.equal(dates.length, 11);
  assert.equal(dates[0].toISOString(), "2026-04-01T00:30:00.000Z");
});

test("ambiguous or invalid credit pointers fail explicitly instead of losing grants", () => {
  for (const nextCreditAt of [new Date("invalid"), new Date("2026-02-15T00:00:00Z")]) {
    assert.throws(() => getDueYearlyCreditGrantDates({
      currentPeriodStart: new Date("2026-01-01T00:00:00Z"),
      currentPeriodEnd: new Date("2027-01-01T00:00:00Z"),
      nextCreditAt, now: new Date("2027-01-01T00:00:00Z"),
    }), /Invalid|Unrecognized/);
  }
});

test("getYearlyCreditGrantKey is stable per subscription and due date", () => {
  const dueDate = new Date("2026-07-08T07:36:12.000Z");

  assert.equal(
    getYearlyCreditGrantKey("sub_123", dueDate),
    `grant_yearly_sub_123_${dueDate.getTime()}`
  );
  assert.notEqual(
    getYearlyCreditGrantKey("sub_456", dueDate),
    getYearlyCreditGrantKey("sub_123", dueDate)
  );
});
