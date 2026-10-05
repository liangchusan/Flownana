import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { AnalyticsEvents } from "@/components/analytics/analytics-events";
import { AnalyticsPreferences } from "@/components/analytics/analytics-preferences";
import { measurementIdForEnvironment } from "@/lib/analytics-policy";

export const metadata: Metadata = {
  title: "Flownana - AI Image & Video Generation",
  description: "Create stunning AI-generated videos, images, and voices with simple text commands. Experience the revolutionary Flownana AI model.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="font-sans">
        <Providers>
          <Suspense fallback={null}>
            <AnalyticsEvents measurementAllowed={Boolean(measurementIdForEnvironment(process.env.VERCEL_ENV, process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID))} />
            <AnalyticsPreferences />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}
