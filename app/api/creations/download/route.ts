import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { buildCreationDownloadFilename } from "@/lib/creation-download";
import { safeRemoteMediaFetch, type RemoteMediaKind } from "@/lib/safe-remote-media";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const creationId =
      searchParams.get("creationId")?.trim() || searchParams.get("id")?.trim();
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
        createdAt: true,
        urls: true,
      },
    });

    if (!creation) {
      return NextResponse.json({ error: "Creation not found" }, { status: 404 });
    }

    const kind: RemoteMediaKind = creation.type === "video" ? "video" : creation.type === "music" ? "music" : "image";
    const mediaRes = await safeRemoteMediaFetch({
      url,
      kind,
      maxBytes: kind === "video" ? 500 * 1024 * 1024 : kind === "music" ? 50 * 1024 * 1024 : 40 * 1024 * 1024,
      timeoutMs: kind === "video" ? 120_000 : 60_000,
    });
    const contentType = mediaRes.contentType;
    const filename = buildCreationDownloadFilename({
      type: creation.type,
      createdAt: creation.createdAt,
      outputIndex: creation.urls.indexOf(url),
      contentType,
    });

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
