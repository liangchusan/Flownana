import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * 全局中间件
 *
 * 说明：
 * - Next.js 要求 middleware.ts 必须导出 `middleware` 或 `default` 函数
 * - 目前我们只是简单地放行所有请求，避免报错
 * - 如果未来需要做服务端重定向/鉴权，可以在这里扩展逻辑
 */
export function middleware(_request: NextRequest) {
  // 当前不做任何处理，直接放行
  return NextResponse.next();
}

// 示例：如果你想只在 /generate 路由下启用该中间件，可以保留以下配置
export const config = {
  matcher: ["/generate/:path*"],
};

