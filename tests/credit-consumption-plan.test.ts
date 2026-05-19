import assert from "node:assert/strict";
import test from "node:test";
import {
  planCreditConsumption,
  sumRemainingCredits,
} from "../lib/credit-consumption-plan.ts";

test("planCreditConsumption consumes FIFO across batches", () => {
  const plan = planCreditConsumption(
    [
      { id: "batch-a", remaining: 1 },
      { id: "batch-b", remaining: 5 },
    ],
    4
  );

  assert.deepEqual(plan, [
    { batchId: "batch-a", amount: 1 },
    { batchId: "batch-b", amount: 3 },
  ]);
});

test("planCreditConsumption skips empty batches", () => {
  const plan = planCreditConsumption(
    [
      { id: "empty", remaining: 0 },
      { id: "active", remaining: 2 },
    ],
    2
  );

  assert.deepEqual(plan, [{ batchId: "active", amount: 2 }]);
});

test("sumRemainingCredits totals available credits", () => {
  assert.equal(
    sumRemainingCredits([
      { id: "a", remaining: 2 },
      { id: "b", remaining: 6 },
    ]),
    8
  );
});
