"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const examples = [
  {
    title: "圣诞贺卡",
    description: "一个忠实描绘的圣诞卡设计，展示戴着圣诞帽的情侣，文字为\"圣诞快乐 2025\"，友好传统，经典设计，在冬季仙境中",
    before: "https://picsum.photos/600/400?random=1",
    after: "https://picsum.photos/600/400?random=2",
  },
  {
    title: "虚拟试衣",
    description: "体验革命性的虚拟试穿技术，无缝地将服装物品放置在模特身上，完美贴合、逼真的垂坠和自然的光照保持。",
    before: "https://picsum.photos/600/400?random=3",
    after: "https://picsum.photos/600/400?random=4",
  },
  {
    title: "文字移除",
    description: "从产品包装中移除不需要的文字和标志，同时保持完美的图像质量和上下文。",
    before: "https://picsum.photos/600/400?random=5",
    after: "https://picsum.photos/600/400?random=6",
  },
  {
    title: "背景更换",
    description: "修改发型和发色，自然逼真的结果与原始图像无缝融合。",
    before: "https://picsum.photos/600/400?random=7",
    after: "https://picsum.photos/600/400?random=8",
  },
];

export function Examples() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextExample = () => {
    setCurrentIndex((prev) => (prev + 1) % examples.length);
  };

  const prevExample = () => {
    setCurrentIndex((prev) => (prev - 1 + examples.length) % examples.length);
  };

  const currentExample = examples[currentIndex];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Nano Banana 应用场景
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            发现 Nano Banana 的多功能性 - 从风格转换到场景修改，
            这个先进的 AI 通过复杂的多图像融合功能，在各种创意项目中提供专业质量的编辑结果。
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">
              {currentExample.title}
            </h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={prevExample}
                className="rounded-full"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600">
                {currentIndex + 1} / {examples.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={nextExample}
                className="rounded-full"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div>
              <div className="bg-gray-100 rounded-lg p-2 mb-2">
                <span className="text-sm font-semibold text-gray-700">修改前</span>
              </div>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-200">
                <img
                  src={currentExample.before}
                  alt="修改前"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div>
              <div className="bg-primary-100 rounded-lg p-2 mb-2">
                <span className="text-sm font-semibold text-primary-700">修改后</span>
              </div>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-200">
                <img
                  src={currentExample.after}
                  alt="修改后"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-700">{currentExample.description}</p>
          </div>
        </div>
      </div>
    </section>
  );
}



