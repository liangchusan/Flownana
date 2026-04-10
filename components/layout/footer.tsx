import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export function Footer() {
  return (
    <footer className="bg-[#1E1E1E] text-stone-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="mb-4">
              <Logo size="sm" textColor="text-white" />
            </div>
            <p className="text-sm mb-4">
              <span className="mt-2 block text-stone-300">
                At Flownana, we believe technology should serve creativity. By integrating cutting-edge AI tools for image,
                video, and audio with a professional-grade creative asset library, we’ve built a one-stop ecosystem for
                visual storytelling. Whether you are a professional editor or a budding enthusiast, Flownana provides the
                tools and inspiration you need to create with confidence and redefine visual expression in the digital age.
              </span>
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Products</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/ai-video" className="transition-all duration-300 hover:text-white">
                  AI Video
                </Link>
              </li>
              <li>
                <Link href="/ai-image" className="transition-all duration-300 hover:text-white">
                  AI Image
                </Link>
              </li>
              <li>
                <Link href="/ai-music" className="transition-all duration-300 hover:text-white">
                  AI Music
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/pricing" className="transition-all duration-300 hover:text-white">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition-all duration-300 hover:text-white">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="transition-all duration-300 hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service" className="transition-all duration-300 hover:text-white">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-8 text-center text-sm">
          <p>Copyright © {new Date().getFullYear()} Flownana. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}



