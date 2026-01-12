import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    description: "Perfect for hobbyists and beginners",
    monthlyPrice: 4.90,
    yearlyPrice: 58.80,
    credits: "6,000 credits/year",
    features: [
      "500 credits/month",
      "Up to 50 images/month",
      "Flownana AI models",
      "Standard generation speed",
      "No watermarks",
      "Customer support",
      "Commercial license",
    ],
  },
  {
    name: "Standard",
    description: "Perfect for creators and professionals",
    monthlyPrice: 9.90,
    yearlyPrice: 118.80,
    credits: "24,000 credits/year",
    popular: true,
    features: [
      "2,000 credits/month",
      "Up to 200 images/month",
      "Flownana AI models",
      "Priority generation queue",
      "No watermarks",
      "Priority customer support",
      "Commercial license",
    ],
  },
  {
    name: "Professional",
    description: "Perfect for advanced users",
    monthlyPrice: 19.90,
    yearlyPrice: 238.80,
    credits: "72,000 credits/year",
    features: [
      "6,000 credits/month",
      "Up to 600 images/month",
      "Flownana AI models",
      "Fastest generation speed",
      "No watermarks",
      "Expert team support",
      "Commercial license",
    ],
  },
];

export function Pricing() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Pricing
          </h2>
          <p className="text-xl text-gray-600">
            Choose the plan that works best for you. All plans include access to our core features.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-lg border-2 p-8 ${
                plan.popular
                  ? "border-blue-500 shadow-xl scale-105"
                  : "border-gray-200"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {plan.name}
              </h3>
              <p className="text-gray-600 mb-6">{plan.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">
                  ${plan.monthlyPrice}
                </span>
                <span className="text-gray-600">/month</span>
              </div>

              <div className="text-sm text-gray-600 mb-6">
                <div>${plan.yearlyPrice}/year</div>
                <div>{plan.credits}</div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start">
                    <Check className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/create?mode=image" className="block">
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                >
                  Subscribe
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
