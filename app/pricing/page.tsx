import { redirect } from "next/navigation";

// Compatibility for bookmarks and existing checkout cancellation URLs only.
export default function PricingPage() {
  redirect("/#pricing");
}
