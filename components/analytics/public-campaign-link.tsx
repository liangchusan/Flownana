"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ComponentProps } from "react";
import { publicCampaignHref } from "@/lib/analytics-policy";

type PublicCampaignLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };
function ResolvedCampaignLink({ href, ...props }: PublicCampaignLinkProps) {
  const pathname = usePathname();
  const query = useSearchParams();
  return <Link {...props} href={publicCampaignHref(href, `https://flownana.invalid${pathname}?${query}`)} />;
}
export function PublicCampaignLink(props: PublicCampaignLinkProps) {
  return <Suspense fallback={<Link {...props} />}><ResolvedCampaignLink {...props} /></Suspense>;
}
