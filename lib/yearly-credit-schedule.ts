export function addMonthsClamped(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() < day) {
    next.setDate(0);
  }
  return next;
}

export function getDueYearlyCreditGrantDates(params: {
  nextCreditAt: Date | null;
  currentPeriodEnd: Date;
  now: Date;
}): Date[] {
  const dates: Date[] = [];
  let cursor = params.nextCreditAt;
  if (!cursor) {
    return dates;
  }

  while (cursor <= params.now && cursor < params.currentPeriodEnd) {
    dates.push(cursor);
    cursor = addMonthsClamped(cursor, 1);
  }

  return dates;
}

export function getNextYearlyCreditAt(params: {
  lastDueCreditAt: Date | null;
  currentPeriodEnd: Date;
}): Date | null {
  if (!params.lastDueCreditAt) {
    return null;
  }

  const nextCreditAt = addMonthsClamped(params.lastDueCreditAt, 1);
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
