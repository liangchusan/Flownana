import type { Metadata } from "next";
import { DesignSystemShowcase } from "@/components/blocks/design-system-showcase";

export const metadata: Metadata = {
  title: "Flownana Design System",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return <DesignSystemShowcase />;
}
