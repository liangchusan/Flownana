import type { JWT } from "next-auth/jwt";

type Account = {
  id: string;
  createdAt: Date;
  name: string | null;
  email: string;
  image: string | null;
};

/** Keep the epoch in the database predicate, including after awaited I/O. */
export function sessionAccountWhere(user: { id: string; accountCreatedAt: string }) {
  const createdAt = new Date(user.accountCreatedAt);
  if (!user.id || !Number.isFinite(createdAt.getTime())) {
    throw new Error("Session revoked; sign in again");
  }
  return { id: user.id, createdAt };
}

/** Only a fresh, server-authenticated sign-in may establish an account epoch. */
export async function refreshAccountToken(params: {
  token: JWT;
  authenticatedUser?: { id: string; accountCreatedAt?: string };
  findAccount: (id: string) => Promise<Account | null>;
}): Promise<JWT> {
  const id = params.authenticatedUser?.id ?? params.token.id;
  const epoch = params.authenticatedUser
    ? params.authenticatedUser.accountCreatedAt
    : params.token.accountCreatedAt;
  if (typeof id !== "string" || !id || typeof epoch !== "string" || !epoch) {
    throw new Error("Session revoked; sign in again");
  }
  const account = await params.findAccount(id);
  if (!account || account.createdAt.toISOString() !== epoch) {
    throw new Error("Session revoked; sign in again");
  }
  return {
    ...params.token,
    id: account.id,
    accountCreatedAt: epoch,
    name: account.name,
    email: account.email,
    picture: account.image,
  };
}
