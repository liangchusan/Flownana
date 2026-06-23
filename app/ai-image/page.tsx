import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { CreateContent } from "./create-content";
import { SessionBoundary } from "@/components/auth/session-boundary";
import { CreateFlowSkeleton } from "@/components/layout/create-flow-skeleton";
import { authOptions } from "@/lib/auth-options";
import { getCreationHistory } from "@/lib/creations";

export default async function AIImagePage() {
  const session = await getServerSession(authOptions);
  const initialCreations = session?.user?.id
    ? await getCreationHistory({ userId: session.user.id, type: "image" })
    : [];

  return (
    <SessionBoundary session={session}>
      <Suspense fallback={<CreateFlowSkeleton />}>
        <CreateContent mode="image" initialCreations={initialCreations} />
      </Suspense>
    </SessionBoundary>
  );
}
