import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getCreationHistory, type CreationType } from "@/lib/creations";
import { del } from "@vercel/blob";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const creationType =
      type === "image" || type === "video" || type === "music"
        ? (type as CreationType)
        : undefined;
    const creations = await getCreationHistory({
      userId: session.user.id,
      type: creationType,
    });

    return NextResponse.json({ success: true, creations });
  } catch (error) {
    console.error("Error fetching creations:", error);
    return NextResponse.json(
      { success: false, creations: [] },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await prisma.generation.deleteMany({
      where: {
        userId: session.user.id,
        OR: [{ id }, { taskId: id }],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting creation:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      id?: string;
      runId?: string;
      action?: "delete-media" | "hide-from-recent";
      url?: string;
    };
    if (!body.action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    if (body.action === "hide-from-recent") {
      const runId = body.runId?.trim();
      const identifiers = body.id?.trim();
      if (!identifiers && !runId) {
        return NextResponse.json({ error: "Missing record target" }, { status: 400 });
      }
      const targets: Prisma.GenerationWhereInput[] = [];
      if (identifiers) {
        targets.push({ id: identifiers }, { taskId: identifiers });
      }
      if (runId) {
        targets.push({ parameters: { path: ["runId"], equals: runId } });
      }
      const generations = await prisma.generation.findMany({
        where: { userId: session.user.id, OR: targets },
        select: { id: true, parameters: true },
      });
      if (generations.length === 0) {
        // A task can fail before the provider creates a persisted record. In that
        // case removing its optimistic Create entry is still a successful action.
        return NextResponse.json({ success: true, updated: 0 });
      }
      await prisma.$transaction(
        generations.map((generation) => {
          const parameters =
            generation.parameters &&
            typeof generation.parameters === "object" &&
            !Array.isArray(generation.parameters)
              ? generation.parameters
              : {};
          return prisma.generation.update({
            where: { id: generation.id },
            data: {
              parameters: {
                ...parameters,
                hiddenFromRecent: true,
              },
            },
          });
        })
      );
      return NextResponse.json({ success: true, updated: generations.length });
    }

    if (!body.id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const generation = await prisma.generation.findFirst({
      where: {
        userId: session.user.id,
        OR: [{ id: body.id }, { taskId: body.id }],
      },
      select: {
        id: true,
        urls: true,
        parameters: true,
        media: {
          where: { role: "output" },
          select: { mediaAssetId: true, mediaAsset: { select: { url: true } } },
        },
      },
    });
    if (!generation) {
      return NextResponse.json({ error: "Creation not found" }, { status: 404 });
    }

    const targetUrl = body.url || generation.urls[0];
    if (!targetUrl) {
      return NextResponse.json({ success: true, urls: generation.urls });
    }
    const nextUrls = generation.urls.filter((url) => url !== targetUrl);
    const outputLink = generation.media.find(
      (item) => item.mediaAsset.url === targetUrl
    );

    await prisma.$transaction([
      prisma.generation.update({
        where: { id: generation.id },
        data: {
          urls: nextUrls,
          status: nextUrls.length > 0 ? "success" : "deleted",
        },
      }),
      ...(outputLink
        ? [
            prisma.generationMedia.deleteMany({
              where: {
                generationId: generation.id,
                mediaAssetId: outputLink.mediaAssetId,
                role: "output",
              },
            }),
          ]
        : []),
    ]);

    if (outputLink) {
      const remainingLinks = await prisma.generationMedia.count({
        where: { mediaAssetId: outputLink.mediaAssetId },
      });
      if (remainingLinks === 0) {
        await prisma.mediaAsset.deleteMany({
          where: {
            id: outputLink.mediaAssetId,
            userId: session.user.id,
          },
        });
        if (
          process.env.BLOB_READ_WRITE_TOKEN &&
          targetUrl.includes(".public.blob.vercel-storage.com")
        ) {
          try {
            await del(targetUrl);
          } catch (blobError) {
            console.error("Failed to delete unreferenced media blob:", blobError);
          }
        }
      }
    }

    return NextResponse.json({ success: true, urls: nextUrls });
  } catch (error) {
    console.error("Error updating creation:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
