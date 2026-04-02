import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

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
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
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
      if (url.includes("/api/auth/callback")) {
        return baseUrl;
      }
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
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
