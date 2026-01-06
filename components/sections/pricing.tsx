import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "基础版",
    description: "适合爱好者和初学者",
    monthlyPrice: 4.90,
    yearlyPrice: 58.80,
    credits: "6,000 积分/年",
    features: [
      "500 积分/月",
      "最多 50 张图像/月",
      "Nano Banana 模型",
      "标准生成速度",
      "无水印",
      "客户支持",
      "商业使用许可",
    ],
  },
  {
    name: "标准版",
    description: "适合创作者和专业人士",
    monthlyPrice: 9.90,
    yearlyPrice: 118.80,
    credits: "24,000 积分/年",
    popular: true,
    features: [
      "2,000 积分/月",
      "最多 200 张图像/月",
      "Nano Banana 模型",
      "优先生成队列",
      "无水印",
      "优先客户支持",
      "商业使用许可",
    ],
  },
  {
    name: "专业版",
    description: "适合高级用户",
    monthlyPrice: 19.90,
    yearlyPrice: 238.80,
    credits: "72,000 积分/年",
    features: [
      "6,000 积分/月",
      "最多 600 张图像/月",
      "Nano Banana 模型",
      "最快生成速度",
      "无水印",
      "专家团队支持",
      "商业使用许可",
    ],
  },
];

export function Pricing() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            定价
          </h2>
          <p className="text-xl text-gray-600">
            选择最适合您的计划。所有计划都包括访问我们的核心功能。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-lg border-2 p-8 ${
                plan.popular
                  ? "border-primary-500 shadow-xl scale-105"
                  : "border-gray-200"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    最受欢迎
                  </span>
                </div>
              )}

              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {plan.name}
              </h3>
              <p className="text-gray-600 mb-6">{plan.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">
                  ${plan.monthlyPrice}
                </span>
                <span className="text-gray-600">/月</span>
              </div>

              <div className="text-sm text-gray-600 mb-6">
                <div>${plan.yearlyPrice}/年</div>
                <div>{plan.credits}</div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start">
                    <Check className="h-5 w-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/generate" className="block">
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                >
                  订阅
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}



