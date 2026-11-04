import type { PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
const BILLING_READ_OPTIONS = { timeout: 8_000, maxNetworkRetries: 0 } as const;

export const CHECKOUT_HISTORY_MIGRATION_ID = "legacy-checkouts-v1";

/** Offline, resumable import. Never called from billing/customer requests. */
export async function importCheckoutHistoryPage(db: PrismaClient, stripe: Stripe) {
  const state = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "CheckoutHistoryMigration" WHERE "id" = ${CHECKOUT_HISTORY_MIGRATION_ID} FOR UPDATE`;
    const row = await tx.checkoutHistoryMigration.findUniqueOrThrow({ where: { id: CHECKOUT_HISTORY_MIGRATION_ID } });
    return row.cutoffAt ? row : tx.checkoutHistoryMigration.update({ where: { id: row.id }, data: { cutoffAt: new Date() } });
  });
  if (state.completedAt) return { complete: true, imported: 0 };
  const page = await stripe.checkout.sessions.list({ limit: 100, created: { lt: Math.ceil(state.cutoffAt!.getTime() / 1000) },
    ...(state.cursor ? { starting_after: state.cursor } : {}) }, BILLING_READ_OPTIONS);
  const next = page.data.at(-1)?.id;
  if (page.has_more && (!next || next === state.cursor)) throw new Error("Checkout import did not advance. No checkpoint changed.");
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "CheckoutHistoryMigration" WHERE "id" = ${state.id} FOR UPDATE`;
    const current = await tx.checkoutHistoryMigration.findUniqueOrThrow({ where: { id: state.id } });
    if (current.cursor !== state.cursor || current.completedAt) return { complete: !!current.completedAt, imported: 0 };
    let imported = 0;
    for (const session of page.data) {
      const userId = session.client_reference_id || session.metadata?.userId;
      if (session.mode !== "subscription" || !userId) continue;
      const epoch = session.metadata?.accountCreatedAt;
      if (epoch && !Number.isFinite(Date.parse(epoch))) throw new Error("Invalid checkout account epoch; import requires investigation.");
      await tx.legacyCheckout.upsert({ where: { id: session.id }, create: { id: session.id, userId,
        accountCreatedAt: epoch ? new Date(epoch) : null, reservationId: session.metadata?.checkoutReservationId || null,
        createdAt: new Date(session.created * 1000) }, update: {} });
      imported++;
    }
    await tx.checkoutHistoryMigration.update({ where: { id: state.id }, data: { cursor: next ?? state.cursor, completedAt: page.has_more ? null : new Date() } });
    return { complete: !page.has_more, imported };
  });
}
