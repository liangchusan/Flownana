import { Star } from "lucide-react";

const testimonials = [
  {
    rating: 5,
    text: "Nano Banana 的一次性编辑绝对令人惊叹！我可以用简单的英语描述复杂的编辑，立即获得完美结果。不再需要在 Photoshop 中花费数小时 - 我只需告诉它我想要什么，它就会发生。我们设计团队的生产力提高了 300%，客户满意度达到了顶峰！",
    author: "Emily Rodriguez",
    role: "创意总监",
    company: "Digital Canvas Agency",
  },
  {
    rating: 5,
    text: "Nano Banana 中的角色一致性是无与伦比的。我可以用相同的角色在不同的场景和姿势中创建整个视觉故事，它们保持完美可识别。面部完成功能拯救了我的肖像摄影业务 - 我现在可以用简单的文本描述修复任何面部缺陷！",
    author: "David Chen",
    role: "专业摄影师",
    company: "Visionary Studios",
  },
  {
    rating: 5,
    text: "Nano Banana 理解上下文的能力是我使用过的任何其他 AI 都无法比拟的。我可以给它复杂的多步骤指令，它会完美执行。场景保持令人难以置信 - 我的编辑看起来完全自然。它比 FLUX Kontext 好得多。这就是图像编辑的未来！",
    author: "Dr. Sarah Thompson",
    role: "数字艺术家和教育家",
    company: "Innovation University",
  },
];

export function Testimonials() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            受到全球创作者信赖
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            看看设计师、摄影师和数字艺术家如何使用 Nano Banana 的革命性 AI 技术
            改变他们的创意工作流程。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-lg p-6"
            >
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 text-yellow-400 fill-yellow-400"
                  />
                ))}
              </div>
              <p className="text-gray-700 mb-6 italic">"{testimonial.text}"</p>
              <div>
                <p className="font-semibold text-gray-900">
                  {testimonial.author}
                </p>
                <p className="text-sm text-gray-600">
                  {testimonial.role}
                </p>
                <p className="text-sm text-gray-500">
                  {testimonial.company}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}



