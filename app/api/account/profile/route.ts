import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { matchesRequestAccount } from "@/lib/account-scope";
import { sessionAccountWhere } from "@/lib/account-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !matchesRequestAccount(request, session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  if (name.length > 80) {
    return NextResponse.json(
      { error: "Name must be 80 characters or less." },
      { status: 400 }
    );
  }

  if (!session.user.email) {
    return NextResponse.json({ error: "Account email is unavailable." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: sessionAccountWhere(session.user),
    data: { name },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });

  return NextResponse.json({ user });
}
