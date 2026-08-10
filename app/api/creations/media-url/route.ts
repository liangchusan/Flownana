import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const KIE_DOWNLOAD_URL_ENDPOINT = "https://api.kie.ai/api/v1/common/download-url";

function isVercelBlobUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      creationId?: string;
      url?: string;
    };
    const creationId = body.creationId?.trim();
    const url = body.url?.trim();

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
      },
      select: { urls: true },
    });

    if (!creation || !creation.urls.includes(url)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (isVercelBlobUrl(url)) {
      return NextResponse.json({ url });
    }

    const apiKey = process.env.NANO_BANANA_API_KEY || process.env.KIE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Media refresh is not configured" },
        { status: 500 }
      );
    }

    const res = await fetch(KIE_DOWNLOAD_URL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    const json = (await res.json().catch(() => null)) as {
      code?: number;
      msg?: string;
      data?: string;
    } | null;

    if (!res.ok || json?.code !== 200 || !json.data) {
      console.error("KIE download-url error:", {
        status: res.status,
        code: json?.code,
        msg: json?.msg,
      });
      return NextResponse.json(
        { error: "Media URL is no longer available" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: json.data });
  } catch (error) {
    console.error("Error refreshing creation media URL:", error);
    return NextResponse.json(
      { error: "Failed to refresh media URL" },
      { status: 500 }
    );
  }
}
