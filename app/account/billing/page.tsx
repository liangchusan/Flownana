import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getBillingSummary } from "@/lib/billing-summary";
import { PLAN_DISPLAY } from "@/lib/plans";
import { finalizeCheckoutSession } from "@/lib/stripe-checkout-finalization";
import { BillingClient, type UpgradeInfo } from "./billing-client";
import { getAccountScope } from "@/lib/account-scope";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

const EMPTY_UPGRADE_INFO: UpgradeInfo = {
  success: false,
  toLabel: null,
  creditCents: 0,
  payableCents: 0,
  currency: "USD",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await getServerSession(authOptions);
  const requestedCompletion =
    getParam(resolvedSearchParams, "checkout") === "success" ||
    getParam(resolvedSearchParams, "upgrade") === "success";
  const sessionId = getParam(resolvedSearchParams, "session_id");
  let isNewCheckout = false;
  let upgradeInfo = EMPTY_UPGRADE_INFO;
  let isPaymentSyncPending = false;

  if (!session?.user?.id) {
    return (
      <BillingClient
        initialAccountScope={null}
        signedIn={false}
        summary={null}
        isNewCheckout={isNewCheckout}
        upgradeInfo={upgradeInfo}
        isPaymentSyncPending={false}
      />
    );
  }

  if (requestedCompletion) {
    if (!sessionId) {
      isPaymentSyncPending = true;
    } else {
      try {
        const completion = await finalizeCheckoutSession({
          sessionId,
          expectedUserId: session.user.id,
          expectedAccountCreatedAt: session.user.accountCreatedAt,
          source: "checkout_return_verified",
        });
        isNewCheckout = !completion.isUpgrade;
        if (completion.isUpgrade) {
          upgradeInfo = {
            success: true,
            toLabel: PLAN_DISPLAY[completion.priceKey].label,
            creditCents: completion.creditAmountCents,
            payableCents: completion.payableAmountCents,
            currency: completion.currency,
          };
        }
      } catch (error) {
        isPaymentSyncPending = true;
        console.error("Checkout return verification failed:", error);
      }
    }
  }

  try {
    const summary = await getBillingSummary(session.user.id, session.user.accountCreatedAt);
    return (
      <BillingClient
        initialAccountScope={getAccountScope(session.user)}
        signedIn
        summary={summary}
        isNewCheckout={isNewCheckout}
        upgradeInfo={upgradeInfo}
        isPaymentSyncPending={isPaymentSyncPending}
      />
    );
  } catch {
    return (
      <BillingClient
        initialAccountScope={getAccountScope(session.user)}
        signedIn
        summary={null}
        error="Could not load billing data"
        isNewCheckout={isNewCheckout}
        upgradeInfo={upgradeInfo}
        isPaymentSyncPending={isPaymentSyncPending}
      />
    );
  }
}
