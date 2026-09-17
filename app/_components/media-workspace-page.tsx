import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { SessionBoundary } from "@/components/auth/session-boundary";
import { MediaCreationWorkspace } from "@/components/blocks/media-creation-workspace";
import type { WorkspaceView } from "@/components/blocks/workspace-sidebar";
import type { ActiveComposerType } from "@/components/blocks/composer-input-controls";
import { CreateFlowSkeleton } from "@/components/layout/create-flow-skeleton";
import { authOptions } from "@/lib/auth-options";
import { getCreationHistory } from "@/lib/creations";
import { getAccountScope } from "@/lib/account-scope";

type WorkspaceSearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function MediaWorkspacePage({
  initialType,
  initialView = "create",
  initialAgentMode = false,
  searchParams,
}: {
  initialType: ActiveComposerType;
  initialView?: WorkspaceView;
  initialAgentMode?: boolean;
  searchParams?: WorkspaceSearchParams;
}) {
  const session = await getServerSession(authOptions);
  const initialCreations = session?.user?.id
    ? await getCreationHistory({ userId: session.user.id, accountCreatedAt: session.user.accountCreatedAt })
    : [];
  // This server-only timestamp records completion of the uncached DB read.
  // eslint-disable-next-line react-hooks/purity
  const historyLoadedAt = Date.now();
  const params = searchParams ? await searchParams : {};
  const prompt = typeof params.prompt === "string" ? params.prompt : undefined;

  return (
    <SessionBoundary session={session}>
      <Suspense fallback={<CreateFlowSkeleton />}>
        <MediaCreationWorkspace
          initialType={initialType}
          initialView={initialView}
          initialCreations={initialCreations}
          initialHistoryLoadedAt={historyLoadedAt}
          initialAccountScope={getAccountScope(session?.user)}
          initialPrompt={prompt}
          initialAgentMode={initialAgentMode}
        />
      </Suspense>
    </SessionBoundary>
  );
}
