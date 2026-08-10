export function countRemainingMonths(
  nextCreditAt: Date | null,
  currentPeriodEnd: Date,
  now: Date = new Date()
): number {
  if (!nextCreditAt) return 0;

  const effectiveStartMs = Math.max(nextCreditAt.getTime(), now.getTime());
  if (effectiveStartMs >= currentPeriodEnd.getTime()) return 0;

  let count = 0;
  const cursor = new Date(effectiveStartMs);
  while (cursor < currentPeriodEnd) {
    count += 1;
    const day = cursor.getDate();
    cursor.setMonth(cursor.getMonth() + 1);
    if (cursor.getDate() < day) cursor.setDate(0);
  }
  return count;
}

export function calculateYearlyUpgradeCreditCents(params: {
  currentYearlyAmountCents: number | null;
  remainingMonths: number;
  targetAmountCents: number;
}): number {
  if (!params.currentYearlyAmountCents || params.remainingMonths <= 0) {
    return 0;
  }

  const monthlyValue = Math.floor(params.currentYearlyAmountCents / 12);
  const unusedValue = monthlyValue * params.remainingMonths;

  // Stripe requires a positive first charge for this checkout flow.
  return Math.min(unusedValue, Math.max(params.targetAmountCents - 1, 0));
}
