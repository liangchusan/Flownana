import { del, put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import {
  getAvatarValidationError,
  isOwnedBlobUrl,
  isMissingProfileSchemaError,
} from "@/lib/account-profile";
import { prisma } from "@/lib/prisma";
import { upsertAppUser } from "@/lib/user-sync";

export const dynamic = "force-dynamic";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96) || "user";
}

async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) return null;

  await upsertAppUser({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  });
  return session.user;
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getAuthenticatedUser();
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
      where: { id: sessionUser.id },
      select: { customAvatarUrl: true },
    });
    const extension = EXTENSIONS[file.type] || "webp";
    const blob = await put(
      `avatars/${safePathSegment(sessionUser.id)}/profile.${extension}`,
      file,
      {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: file.type,
      }
    );

    const user = await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        image: blob.url,
        customAvatarUrl: blob.url,
      },
      select: { id: true, name: true, email: true, image: true },
    });

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

export async function DELETE() {
  try {
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const current = await prisma.user.findUnique({
      where: { id: sessionUser.id },
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
      where: { id: sessionUser.id },
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
