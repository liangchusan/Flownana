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
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Find answers to common questions about Flownana AI content generation
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
