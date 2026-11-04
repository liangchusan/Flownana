import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { withGenerationAccount, type GenerationAccount } from "@/lib/generation-lifecycle";

let active = 0;
export async function withMediaInspection<T>(account: GenerationAccount | undefined, run: () => Promise<T>): Promise<T> {
  // Bound native work per application instance as well as across an account's instances.
  if (active >= 4) throw new Error("Media checks are busy. Please retry shortly.");
  active++;
  let id: string | undefined;
  try {
    if (account) {
      id = await withGenerationAccount(account, async tx => {
        const now = new Date();
        const [attempts, inFlight] = await Promise.all([
          tx.mediaUploadGrant.count({ where: { userId: account.id, kind: "inspection", createdAt: { gt: new Date(now.getTime() - 60_000) } } }),
          tx.mediaUploadGrant.count({ where: { userId: account.id, kind: "inspection", completedAt: null, expiresAt: { gt: now } } }),
        ]);
        if (attempts >= 60 || inFlight >= 2) throw new Error("Too many media checks. Please retry shortly.");
        const lease = await tx.mediaUploadGrant.create({ data: { id: randomUUID(), userId: account.id, kind: "inspection", maxBytes: 0, expiresAt: new Date(now.getTime() + 60_000) } });
        return lease.id;
      });
    }
    return await run();
  } finally {
    active--;
    if (id) await prisma.mediaUploadGrant.updateMany({ where: { id }, data: { completedAt: new Date() } }).catch(() => undefined);
  }
}
