import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Pro",
    description: "720P video output, perfect for steady creation",
    monthlyPrice: 16,
    yearlyPrice: 96,
    credits: "200 credits/month",
    features: [
      "200 credits per month",
      "720P output",
      "Text & image to video",
      "Credits expire after 30 days (FIFO)",
      "No watermarks",
    ],
  },
  {
    name: "Max",
    description: "1080P output and higher monthly credits",
    monthlyPrice: 50,
    yearlyPrice: 300,
    credits: "800 credits/month",
    popular: true,
    features: [
      "800 credits per month",
      "1080P output",
      "Text & image to video",
      "Credits expire after 30 days (FIFO)",
      "No watermarks",
    ],
  },
];

export function Pricing() {
  return (
    <section className="bg-[#FDFDF9] px-4 py-20 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-4xl font-bold text-stone-900 md:text-5xl">
            Pricing
          </h2>
          <p className="text-xl text-stone-600">
            Choose the plan that works best for you. All plans include access to our core features.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-xl border-2 p-8 ${
                plan.popular
                  ? "scale-105 border-stone-700 shadow-xl"
                  : "border-stone-200/50"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="rounded-full bg-stone-700 px-4 py-1 text-sm font-semibold text-white">
                    Most Popular
                  </span>
                </div>
              )}

              <h3 className="mb-2 text-2xl font-bold text-stone-900">
                {plan.name}
              </h3>
              <p className="mb-6 text-stone-600">{plan.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-stone-900">
                  ${plan.monthlyPrice}
                </span>
                <span className="text-stone-600">/month</span>
              </div>

              <div className="mb-6 text-sm text-stone-600">
                <div>${plan.yearlyPrice}/year</div>
                <div>{plan.credits}</div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start">
                    <Check className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-stone-600" />
                    <span className="text-stone-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/pricing" className="block">
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                >
                  View plans
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
