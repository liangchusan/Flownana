import { Wand2, Users, Zap, Globe, Target, Smile } from "lucide-react";

const features = [
  {
    icon: Wand2,
    title: "Perfect Editing on First Try",
    description: "Get perfect results on your first attempt. Flownana's advanced AI technology means no more endless iterations - describe what you want in natural language and see results with cutting-edge accuracy immediately.",
  },
  {
    icon: Users,
    title: "Unmatched Character Consistency",
    description: "Maintain perfect character identity across multiple edits and scene changes. Flownana's AI engine preserves facial features, clothing details, and personal characteristics through advanced character consistency technology.",
  },
  {
    icon: Globe,
    title: "Natural Language Understanding",
    description: "Simply describe your edits in plain English. Flownana understands complex multi-step instructions and integrates world knowledge, making professional content editing accessible to everyone.",
  },
  {
    icon: Zap,
    title: "Lightning-Fast Generation",
    description: "Generate and edit content in just 15-30 seconds. Flownana's optimized architecture delivers professional results at unprecedented speed, perfect for rapid iteration and creative workflows.",
  },
  {
    icon: Target,
    title: "Targeted Natural Language Editing",
    description: "Make precise local edits with simple descriptions. Blur backgrounds, remove blemishes, delete entire people, change poses, or colorize black and white photos - Flownana performs targeted transformations while maintaining image integrity.",
  },
  {
    icon: Smile,
    title: "Facial Completion Magic",
    description: "Revolutionary facial feature completion and editing. Add missing features, modify expressions, or enhance portraits while maintaining natural, photorealistic results.",
  },
];

export function Features() {
  return (
    <section className="bg-[#FDFDF9] px-4 py-24 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-4xl font-bold text-stone-900 md:text-5xl">
            Why Choose Flownana?
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-stone-600 md:text-xl">
            Discover Flownana, a breakthrough AI platform that revolutionizes how creators edit and generate content through unprecedented accuracy, world knowledge integration, and natural language control.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="rounded-2xl border border-stone-200/50 bg-white p-6 shadow-sm transition-all duration-300 hover:border-stone-300/80 hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-stone-900">
                {feature.title}
              </h3>
              <p className="leading-relaxed text-stone-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
