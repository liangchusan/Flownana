export type CreditBatchLike = {
  id: string;
  remaining: number;
};

export type CreditConsumptionPlan = {
  batchId: string;
  amount: number;
}[];

export function planCreditConsumption(
  batches: CreditBatchLike[],
  amount: number
): CreditConsumptionPlan {
  if (amount <= 0) {
    return [];
  }

  let need = amount;
  const consumed: CreditConsumptionPlan = [];

  for (const batch of batches) {
    if (need <= 0) break;
    const take = Math.min(need, batch.remaining);
    if (take <= 0) continue;

    consumed.push({ batchId: batch.id, amount: take });
    need -= take;
  }

  return consumed;
}

export function sumRemainingCredits(batches: CreditBatchLike[]): number {
  let total = 0;
  for (const batch of batches) {
    total += batch.remaining;
  }
  return total;
}
