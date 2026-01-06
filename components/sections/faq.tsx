"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const faqs = [
  {
    question: "什么是 Nano Banana AI？",
    answer: "Nano Banana 是一个突破性的 AI 模型，提供最先进的文本到图像生成和基于文本的图像编辑。它具有多图像融合、角色一致性、自然语言的针对性转换等功能，并利用世界知识实现前所未有的准确性。",
  },
  {
    question: "支持哪些图像格式和分辨率？",
    answer: "Nano Banana 支持所有主要图像格式，包括 PNG、JPEG 和 WebP。该模型在所有分辨率下保持卓越的质量，同时处理时间仅需 15-30 秒。",
  },
  {
    question: "为什么 Nano Banana 比其他 AI 图像模型更好？",
    answer: "Nano Banana 通过独特的功能超越竞争对手：多图像融合能力、世界知识集成、自然语言的针对性编辑、用于故事叙述的完美角色一致性，以及场景感知转换。作为最新的 AI 创新，它在第一次尝试时就能提供完美结果。",
  },
  {
    question: "我可以用 Nano Banana 编辑面部和肖像吗？",
    answer: "是的！Nano Banana 的先进 AI 技术在面部编辑和完成方面表现出色。您可以使用简单的文本描述修改表情、添加缺失特征、修复缺陷或增强肖像。我们的 AI 在所有面部编辑中保持照片级真实质量和自然外观。",
  },
  {
    question: "我可以将生成的图像用于商业目的吗？",
    answer: "是的，通过我们平台生成或编辑的所有图像都可以用于商业目的，包括营销、广告、产品设计和任何其他商业应用。您保留对创建内容的完全权利。",
  },
  {
    question: "如何取消订阅？",
    answer: "您可以随时通过您的账户设置取消订阅。如果您有任何问题或需要帮助，请联系我们的支持团队。",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            常见问题
          </h2>
          <p className="text-xl text-gray-600">
            查找关于 Nano Banana AI 图像生成和编辑的常见问题答案
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900">
                  {faq.question}
                </span>
                {openIndex === index ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </button>
              {openIndex === index && (
                <div className="px-6 py-4 bg-gray-50">
                  <p className="text-gray-700">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}



