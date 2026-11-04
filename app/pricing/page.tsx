import { redirect } from "next/navigation";
import { safeCampaignQuery } from "@/lib/analytics-policy";

// Compatibility for bookmarks and existing checkout cancellation URLs only.
export default async function PricingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  const campaign = safeCampaignQuery(query).query.toString();
  redirect(`/${campaign ? `?${campaign}` : ""}#pricing`);
}
