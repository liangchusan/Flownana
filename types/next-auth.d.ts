import NextAuth from "next-auth";

declare module "next-auth" {
  interface User {
    accountCreatedAt?: string;
    verifiedEmail?: string;
  }
  interface Session {
    user: {
      id: string;
      accountCreatedAt: string;
      name?: string | null;
      email?: string | null;
      emailVerified?: boolean;
      image?: string | null;
    };
  }
}


