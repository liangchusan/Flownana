"use client";

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Mail } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header showBackground />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact Us</h1>
        <p className="text-gray-600 text-lg mb-10">
          Need help, have feedback, or want to report an issue? Email our support team and we’ll get back to you as soon
          as possible.
        </p>

        <div className="rounded-2xl border border-gray-200 p-6 bg-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Support email</div>
              <div className="text-lg font-semibold text-gray-900">support@flownana.com</div>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-5">
            Clicking the button will open your email client with the recipient pre-filled.
          </p>

          <a
            href="mailto:support@flownana.com"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-medium transition-colors"
          >
            Email Support
          </a>
        </div>

        <div className="text-sm text-gray-500 mt-10">
          Looking for legal documents? See{" "}
          <Link href="/privacy-policy" className="text-blue-600 hover:text-blue-700">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms-of-service" className="text-blue-600 hover:text-blue-700">
            Terms of Service
          </Link>
          .
        </div>
      </main>

      <Footer />
    </div>
  );
}

