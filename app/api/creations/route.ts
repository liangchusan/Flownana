import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getAccountScope, matchesRequestAccount } from "@/lib/account-scope";
import { getCreationHistory, type CreationType } from "@/lib/creations";
import { CreationMutationError, deleteCreationOutputs, hideCreations } from "@/lib/creation-mutations";
import { GenerationRequestError } from "@/lib/generation-lifecycle";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !matchesRequestAccount(request, session.user)) {
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
      accountCreatedAt: session.user.accountCreatedAt,
      type: creationType,
    });

    return NextResponse.json({ success: true, accountScope: getAccountScope(session.user), creations });
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
    if (!session?.user?.id || !matchesRequestAccount(request, session.user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await deleteCreationOutputs(session.user, { id, removeRecord: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    return mutationError(error);
  }
}

function mutationError(error: unknown) {
  console.error("Creation mutation failed:", error);
  const status = error instanceof CreationMutationError ? error.status
    : error instanceof GenerationRequestError && error.errorCode === "auth_required" ? 401 : 500;
  return NextResponse.json({ success: false, error: error instanceof CreationMutationError
    ? error.message : status === 401 ? "Unauthorized" : "Could not update creation." }, { status });
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !matchesRequestAccount(request, session.user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!body || !["delete-media", "hide-from-recent"].includes(body.action) ||
      (body.id != null && typeof body.id !== "string") || (body.runId != null && typeof body.runId !== "string") ||
      (body.url != null && typeof body.url !== "string")) {
      return NextResponse.json({ error: "Invalid action or target" }, { status: 400 });
    }
    if (body.action === "hide-from-recent") {
      const updated = await hideCreations(session.user, { id: body.id?.trim(), runId: body.runId?.trim() });
      return NextResponse.json({ success: true, updated });
    }
    if (!body.id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const result = await deleteCreationOutputs(session.user, { id: body.id.trim(), url: body.url });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return mutationError(error);
  }
}
