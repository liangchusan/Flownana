// 在 Next.js 配置加载之前初始化全局代理
if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
  process.env.GLOBAL_AGENT_HTTP_PROXY = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  process.env.GLOBAL_AGENT_HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  require("global-agent/bootstrap");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // 增加 API 路由超时时间
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig


