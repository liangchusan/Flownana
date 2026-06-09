import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function extensionFromContentType(contentType: string | null): string {
  if (!contentType) return "bin";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("mpeg")) return "mp3";
  if (contentType.includes("wav")) return "wav";
  return "bin";
}

function extensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    return match?.[1]?.toLowerCase() || null;
  } catch {
    return null;
  }
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[^a-z0-9-_]/gi, "-").replace(/-+/g, "-").slice(0, 48);
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const creationId = searchParams.get("creationId")?.trim();
    const url = searchParams.get("url")?.trim();
    if (!creationId || !url) {
      return NextResponse.json(
        { error: "Missing creationId or url" },
        { status: 400 }
      );
    }

    const creation = await prisma.generation.findFirst({
      where: {
        userId: session.user.id,
        OR: [{ id: creationId }, { taskId: creationId }],
        urls: { has: url },
      },
      select: {
        id: true,
        type: true,
      },
    });

    if (!creation) {
      return NextResponse.json({ error: "Creation not found" }, { status: 404 });
    }

    const mediaRes = await fetch(url);
    if (!mediaRes.ok || !mediaRes.body) {
      return NextResponse.json(
        { error: "Media unavailable" },
        { status: 502 }
      );
    }

    const contentType =
      mediaRes.headers.get("content-type") || "application/octet-stream";
    const extension =
      extensionFromUrl(url) || extensionFromContentType(contentType);
    const filename = `flownana-${sanitizeFilePart(creation.type)}-${Date.now()}.${extension}`;

    return new NextResponse(mediaRes.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Error downloading creation media:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
