"use client";

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Mail } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header showBackground />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="mb-8">
          <div className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600">
            Support
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-3">Contact Us</h1>
          <p className="text-gray-600">
            Need help, have feedback, or want to report an issue? Email us and we’ll get back to you as soon as possible.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="text-sm text-gray-500">Email</div>
              <div className="text-lg font-semibold text-gray-900 break-all">support@flownana.com</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href="mailto:support@flownana.com"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-medium transition-colors"
            >
              Email Support
            </a>
            <div className="text-sm text-gray-500">
              Or review{" "}
              <Link href="/privacy-policy" className="text-blue-600 hover:text-blue-700">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms-of-service" className="text-blue-600 hover:text-blue-700">
                Terms of Service
              </Link>
              .
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

