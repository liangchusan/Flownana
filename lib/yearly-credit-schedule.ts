export function addMonthsClamped(date: Date, months: number): Date {
  if (!Number.isFinite(date.getTime()) || !Number.isInteger(months)) {
    throw new Error("Invalid credit schedule date");
  }
  const next = new Date(date.getTime());
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(next.getTime());
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  next.setUTCDate(Math.min(day, lastDay.getUTCDate()));
  return next;
}

function monthOffset(start: Date, date: Date): number {
  const approximate = (date.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    date.getUTCMonth() - start.getUTCMonth();
  // The previous local-time implementation can leave a pointer a few days
  // before its UTC month (e.g. March 28 for an April 1 allocation). Match the
  // nearest anchored boundary, not just the pointer's calendar month.
  let closest = approximate;
  let distance = Infinity;
  for (let month = approximate - 1; month <= approximate + 1; month += 1) {
    const delta = Math.abs(addMonthsClamped(start, month).getTime() - date.getTime());
    if (delta < distance) {
      closest = month;
      distance = delta;
    }
  }
  if (distance > 4 * 86_400_000) throw new Error("Unrecognized yearly credit pointer");
  return closest;
}

export function getUnissuedYearlyCreditDates(params: {
  nextCreditAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}): Date[] {
  const { nextCreditAt, currentPeriodStart, currentPeriodEnd } = params;
  if (!nextCreditAt) return [];
  if (![nextCreditAt, currentPeriodStart, currentPeriodEnd].every(
    (date) => Number.isFinite(date.getTime())
  ) || currentPeriodEnd <= currentPeriodStart) {
    throw new Error("Invalid yearly credit period");
  }
  // Month 1 was paid at checkout. Legacy pointers may have drifted to the
  // 28th; preserve their month index without replaying an already issued month.
  const firstMonth = monthOffset(currentPeriodStart, nextCreditAt);
  if (firstMonth < 1) return [];
  const dates: Date[] = [];
  for (let month = firstMonth; month < 12; month += 1) {
    const date = addMonthsClamped(currentPeriodStart, month);
    if (date < currentPeriodEnd) dates.push(date);
  }
  return dates;
}

export function getDueYearlyCreditGrantDates(params: {
  nextCreditAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  now: Date;
}): Date[] {
  if (!Number.isFinite(params.now.getTime())) throw new Error("Invalid current date");
  return getUnissuedYearlyCreditDates(params).filter((date) => date <= params.now);
}

export function getNextYearlyCreditAt(params: {
  lastDueCreditAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}): Date | null {
  if (!params.lastDueCreditAt) {
    return null;
  }

  const nextMonth = monthOffset(params.currentPeriodStart, params.lastDueCreditAt) + 1;
  if (nextMonth < 1 || nextMonth >= 12) return null;
  const nextCreditAt = addMonthsClamped(params.currentPeriodStart, nextMonth);
  return nextCreditAt.getTime() >= params.currentPeriodEnd.getTime()
    ? null
    : nextCreditAt;
}

export function getYearlyCreditGrantKey(
  subscriptionId: string,
  dueDate: Date
): string {
  return `grant_yearly_${subscriptionId}_${dueDate.getTime()}`;
}
