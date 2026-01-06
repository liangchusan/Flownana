import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nano Banana - AI 图像生成与编辑",
  description: "使用简单的文本命令转换您的图像。体验 Nano Banana，革命性的 AI 模型，通过无与伦比的多图像融合和自然语言理解，彻底改变基于文本的图像编辑和生成。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}



