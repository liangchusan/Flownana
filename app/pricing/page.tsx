import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PricingPlans } from "@/components/pricing/pricing-plans";

export default function PricingPage() {
  const stripeEnabled = !!(
    process.env.STRIPE_PRICE_PRO_MONTHLY &&
    process.env.STRIPE_PRICE_PRO_YEARLY &&
    process.env.STRIPE_PRICE_MAX_MONTHLY &&
    process.env.STRIPE_PRICE_MAX_YEARLY
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <Header showBackground />
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Video subscription & credits
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Subscribe for monthly credits. Pro outputs 720P; Max outputs 1080P.
            </p>
            {!stripeEnabled && (
              <p className="text-sm text-amber-700 mt-4">
                Stripe prices are not configured. Add STRIPE_PRICE_* variables to
                enable checkout.
              </p>
            )}
            <Link href="/account/billing" className="inline-block mt-4">
              <Button variant="outline" size="sm">
                Account & billing
              </Button>
            </Link>
          </div>

          <PricingPlans stripeEnabled={stripeEnabled} />
        </div>
      </section>
      <Footer />
    </div>
  );
}
