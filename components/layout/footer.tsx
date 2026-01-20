import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="mb-4">
              <Logo size="sm" className="[&_span]:text-white" />
            </div>
            <p className="text-sm mb-4">
              Create stunning videos, images, and voices with AI. Transform your creative ideas into reality with simple text prompts.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Products</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/ai-video" className="hover:text-white">
                  AI Video
                </Link>
              </li>
              <li>
                <Link href="/ai-image" className="hover:text-white">
                  AI Image
                </Link>
              </li>
              <li>
                <Link href="/ai-music" className="hover:text-white">
                  AI Music
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/pricing" className="hover:text-white">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service" className="hover:text-white">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
          <p>Copyright © 2025 Flownana. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}



