import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getCreationHistory, type CreationType } from "@/lib/creations";

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
