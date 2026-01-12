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
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Why Choose Flownana?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover Flownana, a breakthrough AI platform that revolutionizes how creators edit and generate content through unprecedented accuracy, world knowledge integration, and natural language control.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 text-blue-600 mb-4">
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
