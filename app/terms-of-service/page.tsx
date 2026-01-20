import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata = {
  title: "Terms of Service | Flownana",
};

export default function TermsOfServicePage() {
  const lastUpdated = "January 20, 2026";

  return (
    <div className="min-h-screen bg-white">
      <Header showBackground />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="mb-10">
          <div className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600">
            Legal
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-3">Terms of Service</h1>
          <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="prose prose-gray max-w-none prose-headings:scroll-mt-24 prose-h2:text-2xl prose-h2:font-bold prose-h3:text-lg prose-h3:font-semibold prose-p:leading-relaxed">
          <p>
            These Terms of Service (“Terms”) govern your access to and use of Flownana’s website and services (the
            “Services”). By using the Services, you agree to these Terms. If you do not agree, do not use the Services.
          </p>

          <h2 id="eligibility">1. Eligibility</h2>
          <p>
            You must be at least 13 years old (or the minimum age required by your jurisdiction) to use the Services. If
            you use the Services on behalf of an organization, you represent that you have authority to bind it to these
            Terms.
          </p>

          <h2 id="accounts">2. Accounts</h2>
          <ul>
            <li>
              <strong>Sign-in</strong>: you may be able to sign in through third-party providers (e.g., Google).
            </li>
            <li>
              <strong>Security</strong>: you are responsible for maintaining the confidentiality of your account and for
              all activity under it.
            </li>
          </ul>

          <h2 id="services">3. The Services</h2>
          <p>
            Flownana provides AI-assisted generation tools for videos, images, and music/audio. The Services may change
            over time, and we may add, remove, or modify features.
          </p>

          <h2 id="content">4. Content</h2>
          <h3>4.1 Your Inputs</h3>
          <p>
            You may provide text prompts, images, and other materials (“Inputs”). You represent that you have all rights
            necessary to provide Inputs and to allow us to process them to provide the Services.
          </p>

          <h3>4.2 Outputs</h3>
          <p>
            The Services may generate videos, images, and music/audio (“Outputs”). Outputs are generated automatically
            and may be inaccurate or unsuitable. You are responsible for reviewing Outputs before using or sharing them.
          </p>

          <h3>4.3 Prohibited Content and Conduct</h3>
          <p>You agree not to use the Services to:</p>
          <ul>
            <li>Violate any law or infringe intellectual property or privacy rights.</li>
            <li>Generate or distribute content that is unlawful, harmful, or abusive.</li>
            <li>Attempt to bypass safety filters, security controls, or rate limits.</li>
            <li>Reverse engineer or interfere with the Services.</li>
            <li>Upload malware or attempt unauthorized access to systems or accounts.</li>
          </ul>

          <h2 id="payments">5. Payments and Subscriptions</h2>
          <p>
            Some features may require payment. Pricing, credits, and subscription details (if applicable) will be shown
            at the time of purchase. Taxes may apply. We may update pricing with notice where required by law.
          </p>

          <h2 id="ip">6. Intellectual Property</h2>
          <ul>
            <li>
              <strong>Our IP</strong>: we and our licensors retain all rights in the Services, including software, design,
              and branding.
            </li>
            <li>
              <strong>Your IP</strong>: as between you and Flownana, you retain rights to your Inputs. Your rights to
              Outputs may depend on the underlying data and applicable law.
            </li>
          </ul>

          <h2 id="third-party">7. Third-Party Services</h2>
          <p>
            The Services may integrate with third parties (e.g., authentication, hosting, AI providers). Third-party
            services are governed by their own terms and privacy practices. We are not responsible for third-party
            services.
          </p>

          <h2 id="termination">8. Termination</h2>
          <p>
            You may stop using the Services at any time. We may suspend or terminate access if we believe you violated
            these Terms, created risk, or if required by law.
          </p>

          <h2 id="disclaimers">9. Disclaimers</h2>
          <p>
            THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE”. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED,
            INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. AI OUTPUTS MAY BE
            INACCURATE, OFFENSIVE, OR UNSAFE.
          </p>

          <h2 id="liability">10. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, FLOWSNANA AND ITS AFFILIATES WILL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL.
          </p>

          <h2 id="changes">11. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. We will post the updated Terms and update the “Last updated”
            date. Continued use of the Services after changes means you accept the updated Terms.
          </p>

          <h2 id="contact">12. Contact</h2>
          <p>
            Questions about these Terms? Email{" "}
            <a href="mailto:support@flownana.com">support@flownana.com</a>.
          </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

