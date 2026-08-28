import { del } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import {
  ACTIVE_GENERATION_STATUSES,
  isDeleteConfirmationValid,
  isMissingProfileSchemaError,
  isOwnedBlobUrl,
} from "@/lib/account-profile";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type AccountDeletionData = {
  customAvatarUrl: string | null;
  subscriptions: Array<{ stripeSubscriptionId: string }>;
  generations: Array<{ urls: string[]; inputUrls: string[] }>;
  mediaAssets: Array<{ url: string }>;
};

async function getAccountDeletionData(userId: string): Promise<AccountDeletionData | null> {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        customAvatarUrl: true,
        subscriptions: {
          where: { status: { in: ["active", "trialing"] } },
          select: { stripeSubscriptionId: true },
        },
        generations: {
          select: { urls: true, inputUrls: true },
        },
        mediaAssets: {
          select: { url: true },
        },
      },
    });
  } catch (error) {
    if (!isMissingProfileSchemaError(error)) throw error;

    const account = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptions: {
          where: { status: { in: ["active", "trialing"] } },
          select: { stripeSubscriptionId: true },
        },
        generations: {
          select: { urls: true, inputUrls: true },
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
  if (!session?.user?.id) {
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
    const account = await getAccountDeletionData(session.user.id);

    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const activeGeneration = await prisma.generation.findFirst({
      where: {
        userId: session.user.id,
        status: { in: [...ACTIVE_GENERATION_STATUSES] },
      },
      select: { id: true },
    });
    if (activeGeneration) {
      return NextResponse.json(
        {
          code: "active_generations",
          error: "Wait for active generations to finish or fail before deleting your account.",
        },
        { status: 409 }
      );
    }

    if (account.subscriptions.length > 0) {
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

      for (const subscription of account.subscriptions) {
        try {
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        } catch (error) {
          const stripeError = error as { code?: string };
          if (stripeError.code !== "resource_missing") {
            console.error("Could not cancel subscription before account deletion:", error);
            return NextResponse.json(
              {
                code: "subscription_cancellation_failed",
                error: "We could not cancel your subscription, so your account was not deleted.",
              },
              { status: 502 }
            );
          }
        }
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
      for (const url of [...generation.urls, ...generation.inputUrls]) {
        if (isOwnedBlobUrl(url)) blobUrls.add(url);
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
        await del([...blobUrls]);
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

    await prisma.user.delete({
      where: { id: session.user.id },
      select: { id: true },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion failed:", error);
    return NextResponse.json(
      { error: "Could not delete the account. Nothing else should be retried manually." },
      { status: 500 }
    );
  }
}
