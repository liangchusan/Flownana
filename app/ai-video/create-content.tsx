"use client";

import { useSearchParams } from "next/navigation";
import { MediaCreationWorkspace } from "@/components/blocks/media-creation-workspace";
import type { CreationHistoryItem } from "@/lib/creation-history";

export function CreateContent({ initialCreations = [] }: { mode: "video"; initialCreations?: CreationHistoryItem[] }) {
  const searchParams = useSearchParams();
  return <MediaCreationWorkspace initialType="video" initialCreations={initialCreations} initialPrompt={searchParams.get("prompt") || undefined} />;
}
