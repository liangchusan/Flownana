import { Star } from "lucide-react";

const testimonials = [
  {
    rating: 5,
    text: "Flownana's one-shot editing is absolutely amazing! I can describe complex edits in simple English and get perfect results immediately. No more spending hours in Photoshop - I just tell it what I want and it happens. Our design team's productivity has increased by 300%, and client satisfaction is at an all-time high!",
    author: "Emily Rodriguez",
    role: "Creative Director",
    company: "Digital Canvas Agency",
  },
  {
    rating: 5,
    text: "The character consistency in Flownana is unmatched. I can create entire visual stories with the same character across different scenes and poses, and they remain perfectly recognizable. The facial completion feature saved my portrait photography business - I can now fix any facial imperfection with a simple text description!",
    author: "David Chen",
    role: "Professional Photographer",
    company: "Visionary Studios",
  },
  {
    rating: 5,
    text: "Flownana's ability to understand context is unmatched by any other AI I've used. I can give it complex multi-step instructions and it executes perfectly. The scene preservation is incredible - my edits look completely natural. It's so much better than FLUX Kontext. This is the future of content editing!",
    author: "Dr. Sarah Thompson",
    role: "Digital Artist & Educator",
    company: "Innovation University",
  },
];

export function Testimonials() {
  return (
    <section className="bg-stone-50 px-4 py-24 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-4xl font-bold text-stone-900 md:text-5xl">
            Trusted by Creators Worldwide
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-stone-600 md:text-xl">
            See how designers, photographers, and digital artists are using Flownana&apos;s revolutionary AI technology to transform their creative workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="rounded-2xl border border-stone-200/50 bg-white p-6 shadow-sm transition-all duration-300 hover:border-stone-300/80 hover:shadow-md"
            >
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 text-yellow-400 fill-yellow-400"
                  />
                ))}
              </div>
              <p className="mb-6 italic leading-relaxed text-stone-700">&quot;{testimonial.text}&quot;</p>
              <div>
                <p className="font-semibold text-stone-900">
                  {testimonial.author}
                </p>
                <p className="text-sm text-stone-600">
                  {testimonial.role}
                </p>
                <p className="text-sm text-stone-500">
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
