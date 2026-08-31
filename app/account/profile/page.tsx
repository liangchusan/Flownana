import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AccountProfileClient } from "./profile-client";
import { authOptions } from "@/lib/auth-options";
import { sessionAccountWhere } from "@/lib/account-session";
import { prisma } from "@/lib/prisma";
import { isMissingProfileSchemaError } from "@/lib/account-profile";
import { getAccountScope } from "@/lib/account-scope";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    redirect("/api/auth/signin?callbackUrl=%2Faccount%2Fprofile");
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: sessionAccountWhere(session.user),
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
      where: sessionAccountWhere(session.user),
      select: { name: true, email: true, image: true },
    });
    user = legacyUser ? { ...legacyUser, customAvatarUrl: null } : null;
  }
  if (!user) redirect("/");

  return (
    <AccountProfileClient
      initialAccountScope={getAccountScope(session.user)}
      initialUser={{
        name: user.name || session.user.name || "",
        email: user.email,
        image: user.image,
        hasCustomAvatar: Boolean(user.customAvatarUrl),
      }}
    />
  );
}
