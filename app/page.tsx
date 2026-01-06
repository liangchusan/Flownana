import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Features } from "@/components/sections/features";
import { Examples } from "@/components/sections/examples";
import { Pricing } from "@/components/sections/pricing";
import { Testimonials } from "@/components/sections/testimonials";
import { FAQ } from "@/components/sections/faq";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6">
              革命性的 AI 图像生成与编辑
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              使用简单的文本命令转换您的图像。体验 Nano Banana，革命性的 AI 模型，
              通过无与伦比的多图像融合和自然语言理解，彻底改变基于文本的图像编辑和生成。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/generate">
                <Button size="lg" className="text-lg px-8 py-6">
                  开始创作
                </Button>
              </Link>
              <Link href="/generate">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  查看示例
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <Features />

      {/* Examples Section */}
      <Examples />

      {/* Testimonials */}
      <Testimonials />

      {/* Pricing */}
      <Pricing />

      {/* FAQ */}
      <FAQ />

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary-500 to-primary-600 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            准备好用 AI 魔法转换您的图像了吗？
          </h2>
          <p className="text-xl text-primary-50 mb-8">
            加入数千名创作者，使用 Nano Banana 的革命性 AI 技术。
            体验最先进的多图像融合、完美的一次性编辑和无与伦比的角色一致性。
          </p>
          <Link href="/generate">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
              立即开始创作
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}



