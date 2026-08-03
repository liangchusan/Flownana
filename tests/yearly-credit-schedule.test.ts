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
      currentPeriodEnd: new Date("2027-04-08T07:35:41.000Z"),
    }),
    null
  );
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
