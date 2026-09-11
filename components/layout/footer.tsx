import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export function Footer({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const light = variant === "light";
  const linkClassName = `transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-80 ${light ? "hover:text-foreground" : "hover:text-white"}`;
  return (
    <footer className={light ? "border-t border-border bg-background text-muted-foreground" : "bg-surface-dark text-stone-300"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="mb-4">
              <Logo size="sm" textColor={light ? undefined : "text-white"} />
            </div>
            <p className="text-sm mb-4">
              <span className="mt-2 block">
                At Flownana, we believe technology should serve creativity. By integrating cutting-edge AI tools for image,
                image and video with a professional-grade creative asset library, we’ve built a focused ecosystem for
                visual storytelling. Whether you are a professional editor or a budding enthusiast, Flownana provides the
                tools and inspiration you need to create with confidence and redefine visual expression in the digital age.
              </span>
            </p>
          </div>

          <div>
            <h3 className={`mb-4 font-semibold ${light ? "text-foreground" : "text-white"}`}>Products</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/video" className={linkClassName}>
                  AI Video
                </Link>
              </li>
              <li>
                <Link href="/image" className={linkClassName}>
                  AI Image
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className={`mb-4 font-semibold ${light ? "text-foreground" : "text-white"}`}>Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/pricing" className={linkClassName}>
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/contact" className={linkClassName}>
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className={linkClassName}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service" className={linkClassName}>
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className={`mt-8 border-t pt-8 text-center text-sm ${light ? "border-border" : "border-white/10"}`}>
          <p>Copyright © {new Date().getFullYear()} Flownana. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
