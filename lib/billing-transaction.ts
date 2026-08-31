import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type BillingUser = {
  id: string;
  email: string;
  createdAt: Date;
  stripeCustomerId: string | null;
};

// The User row exists before any subscription. Locking it also serializes
// first invoices, checkout returns and annual cron runs across subscriptions.
export async function withBillingUser<T>(
  userId: string,
  run: (tx: Prisma.TransactionClient, user: BillingUser) => Promise<T>,
  expectedAccountCreatedAt?: string
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, createdAt: true, stripeCustomerId: true },
    });
    if (!user || (expectedAccountCreatedAt &&
      user.createdAt.toISOString() !== expectedAccountCreatedAt)) {
      throw new Error("Billing account no longer exists");
    }
    return run(tx, user);
  }, { maxWait: 5_000, timeout: 30_000 });
}
