import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata = {
  title: "Privacy Policy | Flownana",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "January 20, 2026";

  return (
    <div className="min-h-screen bg-white">
      <Header showBackground />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="mb-10">
          <div className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600">
            Legal
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-3">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="prose prose-gray max-w-none prose-headings:scroll-mt-24 prose-h2:text-2xl prose-h2:font-bold prose-h3:text-lg prose-h3:font-semibold prose-p:leading-relaxed">
          <p>
            This Privacy Policy explains how Flownana (“Flownana”, “we”, “us”, “our”) collects, uses, shares, and
            protects information when you use our website and services (the “Services”).
          </p>

          <h2 id="information-we-collect">1. Information We Collect</h2>
          <h3>1.1 Information you provide</h3>
          <ul>
            <li>
              <strong>Account information</strong>: when you sign in (e.g., via Google), we may receive your name, email
              address, and profile image.
            </li>
            <li>
              <strong>Content</strong>: prompts you enter, images you upload, and outputs you generate (videos, images,
              music/audio).
            </li>
            <li>
              <strong>Support communications</strong>: information you send us when contacting support.
            </li>
          </ul>

          <h3>1.2 Information collected automatically</h3>
          <ul>
            <li>
              <strong>Usage data</strong>: pages visited, actions taken, and feature usage.
            </li>
            <li>
              <strong>Device and log data</strong>: IP address, browser type, device identifiers, and timestamps.
            </li>
            <li>
              <strong>Cookies and similar technologies</strong>: used to operate the Services and remember preferences.
            </li>
          </ul>

          <h2 id="how-we-use">2. How We Use Information</h2>
          <ul>
            <li>
              <strong>Provide and operate</strong> the Services, including generating content you request.
            </li>
            <li>
              <strong>Improve</strong> the Services, reliability, and user experience.
            </li>
            <li>
              <strong>Communicate</strong> with you about updates, security, and support requests.
            </li>
            <li>
              <strong>Prevent fraud and abuse</strong>, enforce our policies, and protect our users.
            </li>
            <li>
              <strong>Comply with legal obligations</strong>.
            </li>
          </ul>

          <h2 id="how-we-share">3. How We Share Information</h2>
          <p>We do not sell your personal information. We may share information in the following situations:</p>
          <ul>
            <li>
              <strong>Service providers</strong>: vendors that help us operate the Services (e.g., hosting, analytics,
              authentication, and payment processing).
            </li>
            <li>
              <strong>AI model and infrastructure providers</strong>: to generate content, we may send prompts and
              uploaded inputs to third-party AI providers and return outputs to you.
            </li>
            <li>
              <strong>Legal</strong>: if required by law or to protect rights, safety, and security.
            </li>
            <li>
              <strong>Business transfers</strong>: in connection with a merger, acquisition, or sale of assets.
            </li>
          </ul>

          <h2 id="content-and-outputs">4. Your Content and AI Outputs</h2>
          <ul>
            <li>
              <strong>Inputs</strong>: prompts and uploaded images are used to provide the requested generation.
            </li>
            <li>
              <strong>Outputs</strong>: generated videos/images/music are returned to you and may be stored to support
              features like history and downloads.
            </li>
            <li>
              <strong>Training</strong>: we may use aggregated and de-identified data to improve the Services. If we use
              your content to improve models or systems in a way that is not de-identified, we will do so only as
              permitted by law and our agreements.
            </li>
          </ul>

          <h2 id="data-retention">5. Data Retention</h2>
          <p>
            We retain information for as long as necessary to provide the Services, comply with legal obligations,
            resolve disputes, and enforce agreements. Retention periods can vary depending on the type of data.
          </p>

          <h2 id="security">6. Security</h2>
          <p>
            We use reasonable administrative, technical, and organizational measures to protect information. No method
            of transmission or storage is 100% secure, so we cannot guarantee absolute security.
          </p>

          <h2 id="your-choices">7. Your Choices</h2>
          <ul>
            <li>
              <strong>Access and update</strong>: you may update certain account details through your sign-in provider.
            </li>
            <li>
              <strong>Cookies</strong>: you can control cookies through your browser settings.
            </li>
            <li>
              <strong>Delete</strong>: you can delete creations stored in your account history where supported by the
              product; you can also contact us to request deletion.
            </li>
          </ul>

          <h2 id="children">8. Children’s Privacy</h2>
          <p>
            The Services are not intended for children under 13 (or the minimum age required by your jurisdiction). We
            do not knowingly collect personal information from children.
          </p>

          <h2 id="international">9. International Transfers</h2>
          <p>
            If you access the Services from outside the United States, your information may be processed in countries
            with different data protection laws. We take steps designed to ensure appropriate safeguards.
          </p>

          <h2 id="changes">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will post the updated version on this page and
            update the “Last updated” date.
          </p>

          <h2 id="contact">11. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, contact us at{" "}
            <a href="mailto:support@flownana.com">support@flownana.com</a>.
          </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

