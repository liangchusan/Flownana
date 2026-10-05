import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getBillingSummary } from "@/lib/billing-summary";
import { PLAN_DISPLAY } from "@/lib/plans";
import { CheckoutPaymentIncompleteError, finalizeCheckoutSession } from "@/lib/stripe-checkout-finalization";
import { reconcilePendingPayment } from "@/lib/payment-reconciliation";
import { BillingClient, type UpgradeInfo } from "./billing-client";
import { getAccountScope } from "@/lib/account-scope";
import type { VerifiedPurchase } from "@/lib/verified-purchase-display";

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
  let paymentNotice: "missing_session" | "unpaid" | "syncing" | "unconfirmed" | null = null;
  let verifiedPurchase: VerifiedPurchase | null = null;

  if (!session?.user?.id) {
    return (
      <BillingClient
        initialAccountScope={null}
        signedIn={false}
        summary={null}
        isNewCheckout={isNewCheckout}
        upgradeInfo={upgradeInfo}
        paymentNotice={null}
        verifiedPurchase={null}
      />
    );
  }

  if (requestedCompletion) {
    if (!sessionId) {
      paymentNotice = "missing_session";
    } else {
      try {
        const completion = await finalizeCheckoutSession({
          sessionId,
          expectedUserId: session.user.id,
          expectedAccountCreatedAt: session.user.accountCreatedAt,
          source: "checkout_return_verified",
        });
        if (!completion.entitlementsReady) {
          paymentNotice = "syncing";
        } else {
          isNewCheckout = !completion.isUpgrade;
          verifiedPurchase = {
            transactionId: sessionId,
            purchaseType: completion.isUpgrade ? "upgrade" : "new_subscription",
            to: completion.priceKey,
            payableCents: completion.payableAmountCents,
            creditCents: completion.creditAmountCents,
            currency: completion.currency,
          };
          if (completion.isUpgrade) {
            upgradeInfo = {
              success: true,
              toLabel: PLAN_DISPLAY[completion.priceKey].label,
              creditCents: completion.creditAmountCents,
              payableCents: completion.payableAmountCents,
              currency: completion.currency,
            };
          }
        }
      } catch (error) {
        paymentNotice = error instanceof CheckoutPaymentIncompleteError ? "unpaid" : "unconfirmed";
        if (paymentNotice === "unconfirmed") console.error("Checkout return verification failed:", error);
      }
    }
  }

  try {
    try {
      await reconcilePendingPayment(session.user.id, session.user.accountCreatedAt);
    } catch (error) {
      console.error("Billing payment reconciliation failed:", error);
    }
    const summary = await getBillingSummary(session.user.id, session.user.accountCreatedAt);
    if (verifiedPurchase && (!summary.subscription ||
      verifiedPurchase.to !== `${summary.subscription.planType}_${summary.subscription.billingCycle}`)) {
      verifiedPurchase = null;
      isNewCheckout = false;
      upgradeInfo = EMPTY_UPGRADE_INFO;
      paymentNotice = "syncing";
    }
    return (
      <BillingClient
        initialAccountScope={getAccountScope(session.user)}
        signedIn
        summary={summary}
        isNewCheckout={isNewCheckout}
        upgradeInfo={upgradeInfo}
        paymentNotice={paymentNotice}
        verifiedPurchase={verifiedPurchase}
      />
    );
  } catch {
    return (
      <BillingClient
        initialAccountScope={getAccountScope(session.user)}
        signedIn
        summary={null}
        error="Could not load billing data"
        isNewCheckout={false}
        upgradeInfo={EMPTY_UPGRADE_INFO}
        paymentNotice={paymentNotice || (verifiedPurchase ? "syncing" : null)}
        verifiedPurchase={null}
      />
    );
  }
}
