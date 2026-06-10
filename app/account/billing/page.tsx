import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getBillingSummary } from "@/lib/billing-summary";
import { BillingClient, type UpgradeInfo } from "./billing-client";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseUpgradeInfo(searchParams: SearchParams): UpgradeInfo {
  return {
    success: getParam(searchParams, "upgrade") === "success",
    from: getParam(searchParams, "from") ?? null,
    to: getParam(searchParams, "to") ?? null,
    creditCents: Number(getParam(searchParams, "credit") || "0"),
    payableCents: Number(getParam(searchParams, "payable") || "0"),
    currency: (getParam(searchParams, "currency") || "usd").toUpperCase(),
    months: Number(getParam(searchParams, "months") || "0"),
  };
}

export default async function BillingPage({
  searchParams = {},
}: {
  searchParams?: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  const isNewCheckout = getParam(searchParams, "checkout") === "success";
  const upgradeInfo = parseUpgradeInfo(searchParams);

  if (!session?.user?.id) {
    return (
      <BillingClient
        signedIn={false}
        summary={null}
        isNewCheckout={isNewCheckout}
        upgradeInfo={upgradeInfo}
      />
    );
  }

  try {
    const summary = await getBillingSummary(session.user.id);
    return (
      <BillingClient
        signedIn
        summary={summary}
        isNewCheckout={isNewCheckout}
        upgradeInfo={upgradeInfo}
      />
    );
  } catch {
    return (
      <BillingClient
        signedIn
        summary={null}
        error="Could not load billing data"
        isNewCheckout={isNewCheckout}
        upgradeInfo={upgradeInfo}
      />
    );
  }
}
