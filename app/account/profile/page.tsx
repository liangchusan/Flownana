import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AccountProfileClient } from "./profile-client";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { upsertAppUser } from "@/lib/user-sync";
import { isMissingProfileSchemaError } from "@/lib/account-profile";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    redirect("/api/auth/signin?callbackUrl=%2Faccount%2Fprofile");
  }

  await upsertAppUser({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  });

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        image: true,
        customAvatarUrl: true,
      },
    });
  } catch (error) {
    if (!isMissingProfileSchemaError(error)) throw error;
    const legacyUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, image: true },
    });
    user = legacyUser ? { ...legacyUser, customAvatarUrl: null } : null;
  }
  if (!user) redirect("/");

  return (
    <AccountProfileClient
      initialUser={{
        name: user.name || session.user.name || "",
        email: user.email,
        image: user.image,
        hasCustomAvatar: Boolean(user.customAvatarUrl),
      }}
    />
  );
}
