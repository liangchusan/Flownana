import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import type { BillingUser } from "@/lib/billing-transaction";

/** One predecessor may fund one successor for the lifetime of that account. */
export async function assertUpgradeConsumption(tx: Prisma.TransactionClient, user: BillingUser, sub: Stripe.Subscription) {
  const predecessorId = sub.metadata.upgradeFromSubscriptionId;
  if (!predecessorId) return;
  if (predecessorId === sub.id) throw new Error("Invalid upgrade predecessor");
  const used = await tx.upgradeConsumption.findUnique({ where: { predecessorId } });
  if (used && (used.successorId !== sub.id || used.userId !== user.id || used.accountCreatedAt.getTime() !== user.createdAt.getTime())) {
    throw new Error("Upgrade predecessor already consumed; payment conflict requires support reconciliation");
  }
}

export async function claimUpgradeConsumption(tx: Prisma.TransactionClient, user: BillingUser, stripe: Stripe, sub: Stripe.Subscription) {
  const predecessorId = sub.metadata.upgradeFromSubscriptionId;
  if (!predecessorId) return;
  await assertUpgradeConsumption(tx, user, sub);
  if (await tx.upgradeConsumption.findUnique({ where: { predecessorId } })) return;
  // Old successful upgrades predate this ledger. Discover their recorded grants
  // before allowing an old unpaid checkout to reuse the predecessor's value.
  const candidates = await tx.subscription.findMany({ where: { userId: user.id, stripeSubscriptionId: { notIn: [sub.id, predecessorId] } }, take: 101 });
  if (candidates.length > 100) throw new Error("Legacy upgrade history requires reconciliation");
  for (const candidate of candidates) {
    if (!await tx.processedStripeEvent.findFirst({ where: { id: { startsWith: `grant_sub_${candidate.stripeSubscriptionId}_` } } })) continue;
    const historical = await stripe.subscriptions.retrieve(candidate.stripeSubscriptionId, {}, { timeout: 8_000, maxNetworkRetries: 0 });
    if (historical.metadata.upgradeFromSubscriptionId === predecessorId) {
      throw new Error("Legacy upgrade predecessor already consumed; payment conflict requires support reconciliation");
    }
  }
  await tx.upgradeConsumption.create({ data: { predecessorId, successorId: sub.id, userId: user.id, accountCreatedAt: user.createdAt } });
}
