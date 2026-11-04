import { del, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { matchesRequestAccount } from "@/lib/account-scope";
import { sessionAccountWhere } from "@/lib/account-session";
import {
  getAvatarValidationError,
  isOwnedBlobUrl,
  isMissingProfileSchemaError,
} from "@/lib/account-profile";
import { withGenerationAccount } from "@/lib/generation-lifecycle";
import { reserveMediaUpload, MediaUploadRateLimitError } from "@/lib/upload-reservation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96) || "user";
}

async function getAuthenticatedUser(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email || !matchesRequestAccount(request, session.user)) return null;

  return session.user;
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getAuthenticatedUser(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Profile photo storage is not configured." },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("avatar");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a profile photo." }, { status: 400 });
    }
    const validationError = getAvatarValidationError(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const uploadId = randomUUID();
    const extension = EXTENSIONS[file.type] || "webp";
    const pathname = `avatars/${safePathSegment(sessionUser.id)}/${uploadId}.${extension}`;
    await reserveMediaUpload(sessionUser.id, { uploadId, kind: "avatar", sizeBytes: file.size }, sessionUser.accountCreatedAt, pathname);
    const blob = await put(
      pathname,
      file,
      {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: file.type,
        abortSignal: AbortSignal.timeout(20_000),
      }
    );

    let result;
    try {
      result = await withGenerationAccount(sessionUser, async tx => {
        const previous = await tx.user.findUniqueOrThrow({ where: sessionAccountWhere(sessionUser), select: { customAvatarUrl: true } });
        const user = await tx.user.update({ where: sessionAccountWhere(sessionUser), data: { image: blob.url, customAvatarUrl: blob.url }, select: { id: true, name: true, email: true, image: true } });
        await tx.mediaUploadGrant.update({ where: { id: uploadId }, data: { blobUrl: blob.url, actualBytes: file.size, completedAt: new Date() } });
        return { user, previous: previous.customAvatarUrl };
      });
    } catch (error) {
      // The pathname reservation survives a failed cleanup or a process interruption.
      await del(blob.url).catch(() => undefined);
      throw error;
    }
    if (result.previous && result.previous !== blob.url && isOwnedBlobUrl(result.previous)) {
      try {
        await del(result.previous);
        await prisma.mediaUploadGrant.updateMany({ where: { kind: "avatar", blobUrl: result.previous }, data: { actualBytes: 0 } });
      } catch { /* Avatar sweeper retries unselected files and quota release. */ }
    }
    const user = result.user;
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile photo upload failed:", error);
    if (error instanceof MediaUploadRateLimitError) return NextResponse.json({ error: "Upload quota exceeded." }, { status: 429 });
    if (isMissingProfileSchemaError(error)) {
      return NextResponse.json(
        { error: "Profile photo updates will be available after the account upgrade finishes." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Could not update the profile photo." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionUser = await getAuthenticatedUser(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return await withGenerationAccount(sessionUser, async tx => {
      const current = await tx.user.findUnique({
        where: sessionAccountWhere(sessionUser),
        select: { customAvatarUrl: true, providerImage: true },
      });
      if (!current) {
        return NextResponse.json({ error: "Account not found." }, { status: 404 });
      }

      if (current.customAvatarUrl && isOwnedBlobUrl(current.customAvatarUrl)) {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          return NextResponse.json(
            { error: "Profile photo storage is not configured." },
            { status: 503 }
          );
        }
        await del(current.customAvatarUrl);
        await tx.mediaUploadGrant.updateMany({ where: { userId: sessionUser.id, kind: "avatar", blobUrl: current.customAvatarUrl }, data: { actualBytes: 0 } });
      }

      const user = await tx.user.update({
        where: sessionAccountWhere(sessionUser),
        data: {
          customAvatarUrl: null,
          image: current.providerImage,
        },
        select: { id: true, name: true, email: true, image: true },
      });
      return NextResponse.json({ user });
    });
  } catch (error) {
    console.error("Profile photo removal failed:", error);
    if (isMissingProfileSchemaError(error)) {
      return NextResponse.json(
        { error: "Profile photo updates will be available after the account upgrade finishes." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Could not remove the profile photo." },
      { status: 500 }
    );
  }
}
