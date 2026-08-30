import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import {
  getTestAuthCreditAmount,
  isServerTestAuthEnabled,
} from "@/lib/test-auth-config";
import { upsertAppUser } from "@/lib/user-sync";

if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
  process.env.GLOBAL_AGENT_HTTP_PROXY =
    process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  process.env.GLOBAL_AGENT_HTTPS_PROXY =
    process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  require("global-agent/bootstrap");
  if (process.env.NODE_ENV === "development") {
    console.log("🌐 全局代理已启用:", {
      HTTP_PROXY: process.env.HTTP_PROXY || "未设置",
      HTTPS_PROXY: process.env.HTTPS_PROXY || "未设置",
    });
  }
}

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const nextAuthUrl = process.env.NEXTAUTH_URL;
const nextAuthSecret = process.env.NEXTAUTH_SECRET;
const testAuthEnabled = isServerTestAuthEnabled(process.env);
const testUserId = process.env.TEST_AUTH_USER_ID || "test-user-local";
const testUserEmail = process.env.TEST_AUTH_EMAIL || "test@flownana.local";
const testUserName = process.env.TEST_AUTH_NAME || "Test User";
const testCreditAmount = getTestAuthCreditAmount(process.env);

async function ensureTestUser() {
  await prisma.user.upsert({
    where: { id: testUserId },
    create: {
      id: testUserId,
      email: testUserEmail,
      name: testUserName,
    },
    update: {
      email: testUserEmail,
      name: testUserName,
    },
  });

  if (Number.isFinite(testCreditAmount) && testCreditAmount > 0) {
    const now = new Date();
    const activeBatch = await prisma.creditBatch.findFirst({
      where: {
        userId: testUserId,
        remaining: { gt: 0 },
        expiresAt: { gt: now },
        source: "test-auth",
      },
    });

    if (!activeBatch) {
      await prisma.creditBatch.create({
        data: {
          userId: testUserId,
          amount: testCreditAmount,
          remaining: testCreditAmount,
          expiresAt: new Date(Date.now() + 30 * 86_400_000),
          source: "test-auth",
        },
      });
    }
  }

  return {
    id: testUserId,
    email: testUserEmail,
    name: testUserName,
  };
}

if (googleClientSecret && !googleClientSecret.startsWith("GOCSPX-")) {
  console.warn(
    "⚠️ 警告: GOOGLE_CLIENT_SECRET 格式可能不正确（通常以 GOCSPX- 开头）"
  );
}

if (process.env.NODE_ENV === "development") {
  console.log("NextAuth 配置检查:");
  console.log("- NEXTAUTH_URL:", nextAuthUrl || "❌ 未设置");
  console.log("- NEXTAUTH_SECRET:", nextAuthSecret ? "✅ 已设置" : "❌ 未设置");
  console.log(
    "- GOOGLE_CLIENT_ID:",
    googleClientId ? `✅ 已设置 (${googleClientId.substring(0, 20)}...)` : "❌ 未设置"
  );
  console.log(
    "- GOOGLE_CLIENT_SECRET:",
    googleClientSecret ? `✅ 已设置 (${googleClientSecret.substring(0, 10)}...)` : "❌ 未设置"
  );
  console.log(
    "- 回调 URL:",
    `${nextAuthUrl || "http://localhost:3000"}/api/auth/callback/google`
  );
  console.log("- TEST_AUTH:", testAuthEnabled ? "✅ 已启用" : "未启用");
}

if (!googleClientId || !googleClientSecret) {
  console.error(
    "❌ Google OAuth 配置缺失！请检查 .env 文件中的 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET"
  );
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  useSecureCookies: process.env.NODE_ENV === "development" ? false : undefined,
  providers: [
    GoogleProvider({
      clientId: googleClientId || "",
      clientSecret: googleClientSecret || "",
      httpOptions: {
        timeout: 30000,
      },
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
      checks: ["pkce", "state"],
    }),
    ...(testAuthEnabled
      ? [
          CredentialsProvider({
            id: "test-login",
            name: "Test Login",
            credentials: {},
            async authorize() {
              return ensureTestUser();
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (process.env.NODE_ENV === "development") {
        console.log("🔐 登录尝试:", {
          user: user?.email,
          provider: account?.provider,
          hasAccessToken: !!account?.access_token,
        });
      }
      if (user?.id && user.email) {
        try {
          await upsertAppUser({
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          });
        } catch (error) {
          console.error("Could not sync signed-in user profile:", error);
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        try {
          const profile = await prisma.user.findUnique({
            where: { id: user.id },
            select: { image: true },
          });
          token.picture = profile?.image ?? user.image;
        } catch {
          token.picture = user.image;
        }
      }
      const updateName =
        typeof session?.user?.name === "string"
          ? session.user.name
          : typeof (session as { name?: unknown } | undefined)?.name === "string"
            ? ((session as { name: string }).name)
            : "";
      if (trigger === "update" && updateName.trim()) {
        token.name = updateName.trim();
      }
      const updatedImage = (
        session as { user?: { image?: string | null } } | undefined
      )?.user;
      if (
        trigger === "update" &&
        updatedImage &&
        Object.prototype.hasOwnProperty.call(updatedImage, "image")
      ) {
        token.picture = updatedImage.image ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || token.sub || "";
        session.user.name = token.name as string | null;
        session.user.email = token.email as string | null;
        session.user.image = token.picture as string | null;
      }
      if (process.env.NODE_ENV === "development") {
        console.log("📋 Session 信息:", {
          userId: session.user?.id,
          userName: session.user?.name,
          userEmail: session.user?.email,
        });
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (process.env.NODE_ENV === "development") {
        console.log("🔄 重定向:", { url, baseUrl });
      }
      if (
        url.includes("/api/auth/error") ||
        url.includes("/api/auth/signin?error")
      ) {
        return baseUrl;
      }
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.origin === baseUrl) return url;
        if (
          testAuthEnabled &&
          (parsedUrl.hostname === "localhost" ||
            parsedUrl.hostname === "127.0.0.1")
        ) {
          return url;
        }
      } catch {
        return baseUrl;
      }
      return baseUrl;
    },
  },
  debug: process.env.NODE_ENV === "development",
  pages: {
    error: "/auth/error",
  },
  events: {
    async signIn({ user, account }) {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ 登录成功:", {
          email: user?.email,
          provider: account?.provider,
        });
      }
    },
  },
};

export const authHandler = NextAuth(authOptions);
