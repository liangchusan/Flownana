import type { Metadata } from "next";
import { Suspense } from "react";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";
import { AnalyticsEvents } from "@/components/analytics/analytics-events";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";

export const metadata: Metadata = {
  title: "Flownana - AI Image & Video Generation",
  description: "Create stunning AI-generated videos, images, and voices with simple text commands. Experience the revolutionary Flownana AI model.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/logo.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans">
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
        <Providers>
          <Suspense fallback={null}>
            <AnalyticsEvents />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}
