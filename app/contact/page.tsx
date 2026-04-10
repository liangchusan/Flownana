"use client";

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Mail } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#FDFDF9]">
      <Header showBackground />

      <main className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-8 py-8 sm:py-14">
        <div className="mb-8">
          <div className="inline-flex items-center rounded-xl border border-stone-200/50 px-3 py-1 text-xs text-stone-600">
            Support
          </div>
          <h1 className="mb-3 mt-4 text-4xl font-bold text-stone-900 md:text-5xl">Contact Us</h1>
          <p className="text-stone-600">
            Need help, have feedback, or want to report an issue? Email us and we’ll get back to you as soon as possible.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/50 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100">
              <Mail className="h-5 w-5 text-stone-600" />
            </div>
            <div className="min-w-0">
              <div className="text-sm text-stone-500">Email</div>
              <div className="break-all text-lg font-semibold text-stone-900">support@flownana.com</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href="mailto:support@flownana.com"
              className="inline-flex items-center justify-center rounded-xl bg-stone-800 px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-stone-800/90 active:scale-[0.98]"
            >
              Email Support
            </a>
            <div className="text-sm text-stone-500">
              Or review{" "}
              <Link href="/privacy-policy" className="text-stone-700 transition-all duration-300 hover:text-stone-900">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms-of-service" className="text-stone-700 transition-all duration-300 hover:text-stone-900">
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

