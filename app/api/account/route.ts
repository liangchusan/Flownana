import { del } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { matchesRequestAccount } from "@/lib/account-scope";
import { sessionAccountWhere } from "@/lib/account-session";
import {
  ACTIVE_GENERATION_STATUSES,
  isDeleteConfirmationValid,
  isMissingProfileSchemaError,
  isOwnedBlobUrl,
} from "@/lib/account-profile";
import { getStripe } from "@/lib/stripe";
import { closeCheckoutBeforeAccountDeletion } from "@/lib/checkout-reservation";
import { BILLING_READ_OPTIONS, verifySubscriptionOwnership } from "@/lib/subscription-sync";
import { isTerminalSubscription } from "@/lib/stripe-billing-policy";
import { generationParameters, getPendingGenerationOutputPaths, hasActiveOutputStorage,
  recoverGenerationObligations, withGenerationAccount } from "@/lib/generation-lifecycle";

export const dynamic = "force-dynamic";

type AccountDeletionData = {
  id: string;
  email: string;
  createdAt: Date;
  stripeCustomerId: string | null;
  customAvatarUrl: string | null;
  subscriptions: Array<{ stripeSubscriptionId: string }>;
  generations: Array<{ urls: string[]; inputUrls: string[]; parameters: unknown }>;
  mediaAssets: Array<{ url: string }>;
};

async function getAccountDeletionData(user: { id: string; accountCreatedAt: string }, tx: Prisma.TransactionClient): Promise<AccountDeletionData | null> {
  await tx.$executeRaw`SAVEPOINT account_profile_columns`;
  try {
    const account = await tx.user.findUnique({
      where: sessionAccountWhere(user),
      select: {
        id: true, email: true, createdAt: true, stripeCustomerId: true,
        customAvatarUrl: true,
        subscriptions: {
          where: { status: { notIn: ["canceled", "incomplete_expired"] } },
          select: { stripeSubscriptionId: true },
        },
        generations: {
          select: { urls: true, inputUrls: true, parameters: true },
        },
        mediaAssets: {
          select: { url: true },
        },
      },
    });
    await tx.$executeRaw`RELEASE SAVEPOINT account_profile_columns`;
    return account;
  } catch (error) {
    if (!isMissingProfileSchemaError(error)) throw error;
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT account_profile_columns`;
    await tx.$executeRaw`RELEASE SAVEPOINT account_profile_columns`;

    const account = await tx.user.findUnique({
      where: sessionAccountWhere(user),
      select: {
        id: true, email: true, createdAt: true, stripeCustomerId: true,
        subscriptions: {
          where: { status: { notIn: ["canceled", "incomplete_expired"] } },
          select: { stripeSubscriptionId: true },
        },
        generations: {
          select: { urls: true, inputUrls: true, parameters: true },
        },
        mediaAssets: {
          select: { url: true },
        },
      },
    });
    return account ? { ...account, customAvatarUrl: null } : null;
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !matchesRequestAccount(request, session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isDeleteConfirmationValid(body?.confirmation)) {
    return NextResponse.json(
      { error: "Type DELETE to confirm account deletion." },
      { status: 400 }
    );
  }

  try {
    await recoverGenerationObligations(session.user);
    return await withGenerationAccount(session.user, async (tx) => {
      const account = await getAccountDeletionData(session.user, tx);

      if (!account) {
        return NextResponse.json({ error: "Account not found." }, { status: 404 });
      }

      const activeGeneration = await tx.generation.findFirst({
        where: {
          userId: session.user.id,
          status: { in: [...ACTIVE_GENERATION_STATUSES] },
        },
        select: { id: true },
      });
      if (activeGeneration || account.generations.some((generation) => hasActiveOutputStorage(generation.parameters))) {
        return NextResponse.json(
          {
            code: "active_generations",
            error: "Wait for active generations to finish or fail before deleting your account.",
          },
          { status: 409 }
        );
      }

      try {
        await closeCheckoutBeforeAccountDeletion(tx, account);
      } catch (error) {
        console.error("Checkout must be reconciled before account deletion:", error);
        return NextResponse.json({ code: "checkout_pending", error: "Your checkout is still being confirmed. Visit Billing before deleting your account." }, { status: 409 });
      }

      if (account.subscriptions.length > 0 || account.stripeCustomerId) {
        let stripe;
        try {
          stripe = getStripe();
        } catch {
          return NextResponse.json(
            {
              code: "subscription_cancellation_failed",
              error: "Subscription cancellation is unavailable. Your account was not deleted.",
            },
            { status: 503 }
          );
        }

        try {
          const ids = new Set(account.subscriptions.map((sub) => sub.stripeSubscriptionId));
          if (account.stripeCustomerId) {
            const remote = await stripe.subscriptions.list({ customer: account.stripeCustomerId, status: "all", limit: 100 },
              BILLING_READ_OPTIONS).autoPagingToArray({ limit: 1_000 });
            remote.filter((sub) => !isTerminalSubscription(sub.status)).forEach((sub) => ids.add(sub.id));
          }
          for (const id of ids) {
            let sub = await stripe.subscriptions.retrieve(id, {}, BILLING_READ_OPTIONS);
            await verifySubscriptionOwnership(account, sub);
            if (!isTerminalSubscription(sub.status)) {
              try {
                sub = await stripe.subscriptions.cancel(id, { prorate: false }, BILLING_READ_OPTIONS);
              } catch (error) {
                sub = await stripe.subscriptions.retrieve(id, {}, BILLING_READ_OPTIONS);
                if (!isTerminalSubscription(sub.status)) throw error;
              }
            }
            if (!isTerminalSubscription(sub.status)) throw new Error("Subscription cancellation is incomplete");
            await tx.subscription.updateMany({ where: { userId: account.id, stripeSubscriptionId: id },
              data: { status: sub.status, nextCreditAt: null } });
          }
        } catch (error) {
          console.error("Could not cancel subscriptions before account deletion:", error);
          return NextResponse.json({ code: "subscription_cancellation_failed",
            error: "We could not cancel your subscription, so your account was not deleted." }, { status: 502 });
        }
      }

      const blobUrls = new Set<string>();
      if (account.customAvatarUrl && isOwnedBlobUrl(account.customAvatarUrl)) {
        blobUrls.add(account.customAvatarUrl);
      }
      for (const asset of account.mediaAssets) {
        if (isOwnedBlobUrl(asset.url)) blobUrls.add(asset.url);
      }
      for (const generation of account.generations) {
        for (const pathname of getPendingGenerationOutputPaths(account.id, generation.parameters)) blobUrls.add(pathname);
        for (const url of [...generation.urls, ...generation.inputUrls]) {
          if (isOwnedBlobUrl(url)) blobUrls.add(url);
        }
        const pending = generationParameters(generation.parameters).pendingMediaCleanup;
        if (Array.isArray(pending)) {
          pending.forEach((url) => { if (typeof url === "string" && isOwnedBlobUrl(url)) blobUrls.add(url); });
        }
      }

      if (blobUrls.size > 0) {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          return NextResponse.json(
            {
              code: "media_deletion_failed",
              error: "Media deletion is unavailable. Your account was not deleted.",
            },
            { status: 503 }
          );
        }
        try {
          await del([...blobUrls], { abortSignal: AbortSignal.timeout(20_000) });
        } catch (error) {
          console.error("Could not delete account media from Vercel Blob:", error);
          return NextResponse.json(
            {
              code: "media_deletion_failed",
              error: "We could not delete all account media, so your account was not deleted.",
            },
            { status: 502 }
          );
        }
      }

      await tx.user.delete({
        where: sessionAccountWhere(session.user),
        select: { id: true },
      });
      return NextResponse.json({ success: true });
    }, 60_000);
  } catch (error) {
    console.error("Account deletion failed:", error);
    return NextResponse.json(
      { error: "Could not delete the account. Nothing else should be retried manually." },
      { status: 500 }
    );
  }
}
