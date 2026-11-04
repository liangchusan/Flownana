import { queueAnalyticsReport, serverMeasurementId } from "@/lib/analytics-server";
import type { AnalyticsContext } from "@/lib/analytics-policy";
import { prisma } from "@/lib/prisma";
import { isMissingProfileSchemaError } from "@/lib/account-profile";
import { awardSignupBonus } from "@/lib/signup-bonus";
import type { SignupBonusEvidence } from "@/lib/signup-bonus-policy";

type AppUserInput = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  analyticsContext?: AnalyticsContext | null;
  signupBonus?: SignupBonusEvidence;
};

// Explicit projection keeps the legacy profile-schema fallback usable without
// bypassing the new-account/bonus/analytics transaction.
const accountSelect = {
  id: true, email: true, name: true, image: true, stripeCustomerId: true,
  createdAt: true, updatedAt: true,
} as const;

async function createAppUser(params: AppUserInput, legacyProfile = false) {
  return prisma.$transaction(async tx => {
    const created = await tx.user.createMany({ data: {
      id: params.id, email: params.email, name: params.name ?? undefined,
      image: params.image ?? undefined,
      ...(!legacyProfile ? { providerImage: params.image ?? undefined } : {}),
    }, skipDuplicates: true });
    const user = await tx.user.findUniqueOrThrow({ where: { id: params.id }, select: accountSelect });
    if (created.count) {
      if (params.signupBonus) await awardSignupBonus(tx, user.id, params.signupBonus);
      if (serverMeasurementId()) await queueAnalyticsReport(tx, {
        userId: user.id, key: `${user.id}:${user.createdAt.toISOString()}`,
        name: "sign_up", params: { method: "google" },
        context: params.analyticsContext || null, occurredAt: user.createdAt,
      });
    }
    return user;
  });
}

export async function upsertAppUser(params: AppUserInput) {
  try {
    const existing = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        name: true,
        customAvatarUrl: true,
      },
    });

    if (!existing) {
      return await createAppUser(params);
    }

    return prisma.user.update({
      where: { id: params.id },
      data: {
        email: params.email,
        providerImage: params.image ?? null,
        ...(!existing.name && params.name ? { name: params.name } : {}),
        ...(!existing.customAvatarUrl ? { image: params.image ?? null } : {}),
      },
    });
  } catch (error) {
    if (!isMissingProfileSchemaError(error)) throw error;

    const existing = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) return createAppUser(params, true);
    return prisma.user.update({
      where: { id: params.id },
      data: {
        email: params.email,
      },
      select: accountSelect,
    });
  }
}
