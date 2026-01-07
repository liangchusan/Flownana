import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// 配置全局代理（如果设置了 HTTP_PROXY 环境变量）
// global-agent 需要在所有模块导入之前加载，使用环境变量方式
if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
  // 设置 global-agent 需要的环境变量
  process.env.GLOBAL_AGENT_HTTP_PROXY = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  process.env.GLOBAL_AGENT_HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  
  // 必须在所有其他导入之前加载 global-agent
  require("global-agent/bootstrap");
  
  if (process.env.NODE_ENV === "development") {
    console.log("🌐 全局代理已启用:", {
      HTTP_PROXY: process.env.HTTP_PROXY || "未设置",
      HTTPS_PROXY: process.env.HTTPS_PROXY || "未设置",
      GLOBAL_AGENT_HTTP_PROXY: process.env.GLOBAL_AGENT_HTTP_PROXY,
    });
  }
}

// 验证环境变量
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const nextAuthUrl = process.env.NEXTAUTH_URL;
const nextAuthSecret = process.env.NEXTAUTH_SECRET;

// 验证 Client Secret 格式（Google OAuth 2.0 Client Secret 通常以 GOCSPX- 开头）
if (googleClientSecret && !googleClientSecret.startsWith("GOCSPX-")) {
  console.warn("⚠️ 警告: GOOGLE_CLIENT_SECRET 格式可能不正确（通常以 GOCSPX- 开头）");
}

// 开发环境下输出配置状态（帮助调试）
if (process.env.NODE_ENV === "development") {
  console.log("NextAuth 配置检查:");
  console.log("- NEXTAUTH_URL:", nextAuthUrl || "❌ 未设置");
  console.log("- NEXTAUTH_SECRET:", nextAuthSecret ? "✅ 已设置" : "❌ 未设置");
  console.log("- GOOGLE_CLIENT_ID:", googleClientId ? `✅ 已设置 (${googleClientId.substring(0, 20)}...)` : "❌ 未设置");
  console.log("- GOOGLE_CLIENT_SECRET:", googleClientSecret ? `✅ 已设置 (${googleClientSecret.substring(0, 10)}...)` : "❌ 未设置");
  console.log("- 回调 URL:", `${nextAuthUrl || "http://localhost:3000"}/api/auth/callback/google`);
  console.log("⚠️ 请确保在 Google Cloud Console 中已添加此回调 URL！");
}

if (!googleClientId || !googleClientSecret) {
  console.error("❌ Google OAuth 配置缺失！请检查 .env 文件中的 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET");
}

// 验证配置完整性
if (!googleClientId || !googleClientSecret) {
  console.error("❌ 致命错误：Google OAuth 配置不完整！");
  console.error("   GOOGLE_CLIENT_ID:", googleClientId ? "✅" : "❌ 缺失");
  console.error("   GOOGLE_CLIENT_SECRET:", googleClientSecret ? "✅" : "❌ 缺失");
  console.error("   请检查 .env 文件是否在项目根目录，且内容正确。");
}

const authOptions: NextAuthOptions = {
  // 使用 JWT 策略（不需要数据库）
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: googleClientId || "",
      clientSecret: googleClientSecret || "",
      // 增加超时时间到 30 秒，应对网络延迟
      httpOptions: {
        timeout: 30000, // 30 秒
      },
      // 使用更宽松的授权参数
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
      // 确保使用正确的 token 端点
      checks: ["pkce", "state"],
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // 记录登录尝试
      if (process.env.NODE_ENV === "development") {
        console.log("🔐 登录尝试:", { 
          user: user?.email, 
          provider: account?.provider,
          hasAccessToken: !!account?.access_token 
        });
      }
      // 允许所有登录
      return true;
    },
    async jwt({ token, user, account }) {
      // 首次登录时，将用户信息保存到 token
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      // 从 token 中读取用户信息并添加到 session
      if (session.user) {
        session.user.id = token.id as string || token.sub || "";
        session.user.name = token.name as string || null;
        session.user.email = token.email as string || null;
        session.user.image = token.picture as string || null;
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
      // 记录重定向信息
      if (process.env.NODE_ENV === "development") {
        console.log("🔄 重定向:", { url, baseUrl });
      }
      
      // 如果 URL 是错误页面，重定向到首页
      if (url.includes("/api/auth/error") || url.includes("/api/auth/signin?error")) {
        return baseUrl;
      }
      
      // 如果 URL 是回调页面，重定向到首页
      if (url.includes("/api/auth/callback")) {
        return baseUrl;
      }
      
      // 确保重定向到同源
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  debug: process.env.NODE_ENV === "development",
  pages: {
    error: "/auth/error",
  },
  // 添加更详细的错误处理
  events: {
    async signIn({ user, account }) {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ 登录成功:", { 
          email: user?.email,
          provider: account?.provider 
        });
      }
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

