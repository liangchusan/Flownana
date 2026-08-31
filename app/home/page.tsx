import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { CreateContent } from "./create-content";
import { SessionBoundary } from "@/components/auth/session-boundary";
import { CreateFlowSkeleton } from "@/components/layout/create-flow-skeleton";
import { authOptions } from "@/lib/auth-options";
import { getCreationHistory } from "@/lib/creations";
import { getAccountScope } from "@/lib/account-scope";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const initialRecentCreations = session?.user?.id
    ? await getCreationHistory({ userId: session.user.id, accountCreatedAt: session.user.accountCreatedAt, take: 8 })
    : [];

  return (
    <SessionBoundary session={session}>
      <Suspense fallback={<CreateFlowSkeleton />}>
        <CreateContent initialRecentCreations={initialRecentCreations} initialAccountScope={getAccountScope(session?.user)} />
      </Suspense>
    </SessionBoundary>
  );
}
