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

    const previous = await prisma.user.findUnique({
      where: sessionAccountWhere(sessionUser),
      select: { customAvatarUrl: true },
    });
    if (!previous) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const extension = EXTENSIONS[file.type] || "webp";
    const blob = await put(
      `avatars/${safePathSegment(sessionUser.id)}/${randomUUID()}.${extension}`,
      file,
      {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: file.type,
      }
    );

    let user;
    try {
      user = await prisma.user.update({
        where: sessionAccountWhere(sessionUser),
        data: { image: blob.url, customAvatarUrl: blob.url },
        select: { id: true, name: true, email: true, image: true },
      });
    } catch (error) {
      await del(blob.url).catch((cleanupError) => {
        console.error("Could not clean up an unsaved profile photo:", cleanupError);
      });
      throw error;
    }

    if (
      previous?.customAvatarUrl &&
      previous.customAvatarUrl !== blob.url &&
      isOwnedBlobUrl(previous.customAvatarUrl)
    ) {
      del(previous.customAvatarUrl).catch((error) => {
        console.error("Could not delete previous profile photo:", error);
      });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile photo upload failed:", error);
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

    const current = await prisma.user.findUnique({
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
    }

    const user = await prisma.user.update({
      where: sessionAccountWhere(sessionUser),
      data: {
        customAvatarUrl: null,
        image: current.providerImage,
      },
      select: { id: true, name: true, email: true, image: true },
    });
    return NextResponse.json({ user });
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
