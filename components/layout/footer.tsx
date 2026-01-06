import Link from "next/link";
import { ImageIcon } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <ImageIcon className="h-6 w-6 text-primary-400" />
              <span className="text-xl font-bold text-white">Nano Banana</span>
            </div>
            <p className="text-sm mb-4">
              使用简单的文本命令转换您的图像。体验革命性的 AI 模型，
              通过无与伦比的多图像融合和自然语言理解，彻底改变基于文本的图像编辑和生成。
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">功能</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/generate" className="hover:text-white">
                  文本生成图像
                </Link>
              </li>
              <li>
                <Link href="/generate" className="hover:text-white">
                  图像编辑
                </Link>
              </li>
              <li>
                <Link href="/generate" className="hover:text-white">
                  图像融合
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">平台</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-white">
                  定价
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-white">
                  联系我们
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-white">
                  隐私政策
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-white">
                  服务条款
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
          <p>Copyright © 2025 Nano Banana. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}



