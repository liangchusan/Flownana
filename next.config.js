// 在 Next.js 配置加载之前初始化全局代理
if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
  process.env.GLOBAL_AGENT_HTTP_PROXY = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  process.env.GLOBAL_AGENT_HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  require("global-agent/bootstrap");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
  },
  // 增加 API 路由超时时间
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

module.exports = nextConfig;
