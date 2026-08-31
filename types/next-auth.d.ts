import NextAuth from "next-auth";

declare module "next-auth" {
  interface User {
    accountCreatedAt?: string;
  }
  interface Session {
    user: {
      id: string;
      accountCreatedAt: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}


