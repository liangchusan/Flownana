import { Wand2, Users, Zap, Globe, Target, Smile } from "lucide-react";

const features = [
  {
    icon: Wand2,
    title: "一次性完美编辑",
    description: "第一次尝试就能获得完美结果。Nano Banana 的先进 AI 技术意味着不再需要无尽的迭代 - 用自然语言描述您想要的，立即看到最先进准确度的结果。",
  },
  {
    icon: Users,
    title: "无与伦比的角色一致性",
    description: "在多次编辑和场景变化中保持完美的角色身份。Nano Banana 的 AI 引擎通过先进的角色一致性技术保留面部特征、服装细节和个人特征。",
  },
  {
    icon: Globe,
    title: "自然语言理解",
    description: "只需用简单的英语描述您的编辑。Nano Banana 理解复杂的多步骤指令，并集成世界知识，使专业图像编辑对每个人都可访问。",
  },
  {
    icon: Zap,
    title: "闪电般快速生成",
    description: "仅需 15-30 秒即可生成和编辑图像。Nano Banana 的优化架构以前所未有的速度提供专业结果，非常适合快速迭代和创意工作流程。",
  },
  {
    icon: Target,
    title: "针对性自然语言编辑",
    description: "用简单的描述进行精确的局部编辑。模糊背景、去除污渍、删除整个人物、改变姿势或为黑白照片着色 - Nano Banana 执行针对性转换，同时保持图像完整性。",
  },
  {
    icon: Smile,
    title: "面部完成魔法",
    description: "革命性的面部特征完成和编辑。添加缺失的特征、修改表情或增强肖像，同时保持自然、逼真的结果。",
  },
];

export function Features() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            为什么选择 Nano Banana AI？
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            发现 Nano Banana，突破性的 AI 模型，通过前所未有的准确性、
            世界知识集成和自然语言控制，彻底改变创作者编辑和生成图像的方式。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary-100 text-primary-600 mb-4">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}



