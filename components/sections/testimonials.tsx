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
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Trusted by Creators Worldwide
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            See how designers, photographers, and digital artists are using Flownana's revolutionary AI technology to transform their creative workflows.
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
