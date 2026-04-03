"use client";

import { Suspense } from "react";
import { CreateContent } from "./create-content";
import { CreateFlowSkeleton } from "@/components/layout/create-flow-skeleton";

export default function CreateModePage({
  params,
}: {
  params: { mode: string };
}) {
  return (
    <Suspense fallback={<CreateFlowSkeleton />}>
      <CreateContent mode={params.mode as "video" | "image" | "voice"} />
    </Suspense>
  );
}
