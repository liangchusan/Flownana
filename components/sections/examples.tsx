"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const examples = [
  {
    title: "Christmas Card Design",
    description: "A faithfully rendered Christmas card design featuring a couple wearing Santa hats, with text reading 'Merry Christmas 2025', friendly and traditional, classic design, in a winter wonderland setting.",
    before: "https://picsum.photos/600/400?random=1",
    after: "https://picsum.photos/600/400?random=2",
  },
  {
    title: "Virtual Try-On",
    description: "Experience revolutionary virtual try-on technology that seamlessly places clothing items on models with perfect fit, realistic draping, and natural lighting preservation.",
    before: "https://picsum.photos/600/400?random=3",
    after: "https://picsum.photos/600/400?random=4",
  },
  {
    title: "Text Removal",
    description: "Remove unwanted text and logos from product packaging while maintaining perfect image quality and context.",
    before: "https://picsum.photos/600/400?random=5",
    after: "https://picsum.photos/600/400?random=6",
  },
  {
    title: "Background Replacement",
    description: "Modify hairstyles and hair colors with natural, photorealistic results that seamlessly blend with the original image.",
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
            Flownana Use Cases
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover the versatility of Flownana - from style transformations to scene modifications, 
            this advanced AI delivers professional-quality editing results across various creative projects through sophisticated multi-image fusion capabilities.
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
                <span className="text-sm font-semibold text-gray-700">Before</span>
              </div>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-200">
                <img
                  src={currentExample.before}
                  alt="Before"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div>
              <div className="bg-blue-100 rounded-lg p-2 mb-2">
                <span className="text-sm font-semibold text-blue-700">After</span>
              </div>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-200">
                <img
                  src={currentExample.after}
                  alt="After"
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
