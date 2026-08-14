"use client";

import { useSearchParams } from "next/navigation";
import { MediaCreationWorkspace } from "@/components/blocks/media-creation-workspace";
import type { CreationHistoryItem } from "@/lib/creation-history";

export function CreateContent({ initialCreations = [] }: { mode: "voice"; initialCreations?: CreationHistoryItem[] }) {
  const searchParams = useSearchParams();
  return <MediaCreationWorkspace initialType="music" initialCreations={initialCreations} initialPrompt={searchParams.get("prompt") || undefined} />;
}
