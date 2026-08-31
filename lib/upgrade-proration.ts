import { addMonthsClamped, getUnissuedYearlyCreditDates } from "./yearly-credit-schedule.ts";

export function countRemainingMonths(
  nextCreditAt: Date | null,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  now: Date = new Date()
): number {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid current date");
  return getUnissuedYearlyCreditDates({ nextCreditAt, currentPeriodStart, currentPeriodEnd })
    .filter((date) => {
      const month = (date.getUTCFullYear() - currentPeriodStart.getUTCFullYear()) * 12 +
        date.getUTCMonth() - currentPeriodStart.getUTCMonth();
      // Retain the existing rule: an overdue but not fully elapsed allocation
      // still has unused value. Never manufacture a thirteenth allocation.
      return Math.min(addMonthsClamped(currentPeriodStart, month + 1).getTime(),
        currentPeriodEnd.getTime()) > now.getTime();
    }).length;
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
