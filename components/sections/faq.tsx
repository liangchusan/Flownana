"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const faqs = [
  {
    question: "What is Flownana AI?",
    answer: "Flownana is a comprehensive AI platform that provides advanced video, image, and voice generation capabilities. Powered by cutting-edge models like VEO 3.1, Nano Banana, and Suno, it enables creators to generate professional content with simple text prompts.",
  },
  {
    question: "What image formats and resolutions are supported?",
    answer: "Flownana supports all major image formats including PNG, JPEG, and WebP. Our AI models maintain excellent quality across all resolutions, with processing times typically ranging from 15-30 seconds.",
  },
  {
    question: "Why is Flownana better than other AI content generation platforms?",
    answer: "Flownana stands out with unique capabilities: multi-image fusion, world knowledge integration, natural language editing, perfect character consistency for storytelling, and scene-aware transformations. As the latest AI innovation, it delivers perfect results on the first try.",
  },
  {
    question: "Can I edit faces and portraits with Flownana?",
    answer: "Yes! Flownana's advanced AI technology excels at facial editing and completion. You can modify expressions, add missing features, fix imperfections, or enhance portraits using simple text descriptions. Our AI maintains photorealistic quality and natural appearance in all facial edits.",
  },
  {
    question: "Can I use generated content for commercial purposes?",
    answer: "Yes, all images, videos, and audio generated or edited through our platform can be used for commercial purposes, including marketing, advertising, product design, and any other business applications. You retain full rights to the content you create.",
  },
  {
    question: "How do I cancel my subscription?",
    answer: "You can cancel your subscription at any time through your account settings. If you have any questions or need assistance, please contact our support team.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="bg-[#FDFDF9] px-4 py-24 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-4xl font-bold text-stone-900 md:text-5xl">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-stone-600 md:text-xl">
            Find answers to common questions about Flownana AI content generation
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-stone-200/50 bg-white shadow-sm transition-all duration-300 hover:border-stone-300/80"
            >
              <button
                type="button"
                onClick={() => toggleFAQ(index)}
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-all duration-300 hover:bg-stone-50 active:scale-[0.99]"
              >
                <span className="font-semibold text-stone-900">
                  {faq.question}
                </span>
                {openIndex === index ? (
                  <ChevronUp className="h-5 w-5 text-stone-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-stone-500" />
                )}
              </button>
              {openIndex === index && (
                <div className="bg-stone-50 px-6 py-4">
                  <p className="leading-relaxed text-stone-700">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
