import { prisma } from "@/lib/prisma";
import { isMissingProfileSchemaError } from "@/lib/account-profile";

export async function upsertAppUser(params: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  try {
    const existing = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        name: true,
        customAvatarUrl: true,
      },
    });

    if (!existing) {
      return prisma.user.create({
        data: {
          id: params.id,
          email: params.email,
          name: params.name ?? undefined,
          image: params.image ?? undefined,
          providerImage: params.image ?? undefined,
        },
      });
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

    return prisma.user.upsert({
      where: { id: params.id },
      create: {
        id: params.id,
        email: params.email,
        name: params.name ?? undefined,
        image: params.image ?? undefined,
      },
      update: {
        email: params.email,
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        stripeCustomerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
