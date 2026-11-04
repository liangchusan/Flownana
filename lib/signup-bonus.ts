import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SIGNUP_BONUS_CREDITS, SIGNUP_BONUS_LIFETIME_MS, SIGNUP_IP_WINDOW_MS,
  signupCountryEligible, type SignupBonusEvidence,
} from "@/lib/signup-bonus-policy";

/** Called only for a newly inserted Google account, in the SAME transaction.
 * The conditional upsert serializes competing IP claims across all instances.
 * Decisions intentionally retain no IP hash; the expiring window has no user FK.
 */
export async function awardSignupBonus(
  tx: Prisma.TransactionClient,
  userId: string,
  evidence: SignupBonusEvidence,
  now = new Date(),
) {
  let reason = "source_unavailable";
  if (evidence.ipHash && /^[a-f0-9]{64}$/.test(evidence.ipHash)) {
    const expiresAt = new Date(now.getTime() + SIGNUP_IP_WINDOW_MS);
    const claimed = await tx.$queryRaw<Array<{ ipHash: string }>>`
      INSERT INTO "SignupIpWindow" ("ipHash", "startedAt", "expiresAt")
      VALUES (${evidence.ipHash}, ${now.toISOString()}::timestamp(3), ${expiresAt.toISOString()}::timestamp(3))
      ON CONFLICT ("ipHash") DO UPDATE
        SET "startedAt" = EXCLUDED."startedAt", "expiresAt" = EXCLUDED."expiresAt"
        WHERE "SignupIpWindow"."expiresAt" <= EXCLUDED."startedAt"
      RETURNING "ipHash"
    `;
    reason = claimed.length === 0 ? "ip_limit" :
      signupCountryEligible(evidence.country) ? "granted" : "country_ineligible";
  }
  await tx.signupBonusDecision.create({ data: { userId, reason } });
  if (reason === "granted") {
    await tx.creditBatch.create({ data: {
      userId, amount: SIGNUP_BONUS_CREDITS, remaining: SIGNUP_BONUS_CREDITS,
      source: "signup-bonus", expiresAt: new Date(now.getTime() + SIGNUP_BONUS_LIFETIME_MS),
    } });
  }
}

/** Daily existing authenticated maintenance; expired rows no longer authorize a claim. */
export async function cleanupSignupIpWindows(now = new Date()) {
  return prisma.signupIpWindow.deleteMany({ where: { expiresAt: { lte: now } } });
}
