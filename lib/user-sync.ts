import { prisma } from "@/lib/prisma";

export async function upsertAppUser(params: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  await prisma.user.upsert({
    where: { id: params.id },
    create: {
      id: params.id,
      email: params.email,
      name: params.name ?? undefined,
      image: params.image ?? undefined,
    },
    update: {
      email: params.email,
      name: params.name ?? undefined,
      image: params.image ?? undefined,
    },
  });
}
