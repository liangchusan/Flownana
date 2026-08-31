"use client";

import { useSearchParams } from "next/navigation";
import { MediaCreationWorkspace } from "@/components/blocks/media-creation-workspace";
import type { CreationHistoryItem } from "@/lib/creation-history";

export function CreateContent({ initialCreations = [], initialAccountScope }: { mode: "image"; initialCreations?: CreationHistoryItem[]; initialAccountScope?: string | null }) {
  const searchParams = useSearchParams();
  return <MediaCreationWorkspace initialType="image" initialCreations={initialCreations} initialAccountScope={initialAccountScope} initialPrompt={searchParams.get("prompt") || undefined} />;
}
