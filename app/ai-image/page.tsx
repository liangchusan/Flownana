"use client";

import { Suspense } from "react";
import { CreateContent } from "./create-content";
import { CreateFlowSkeleton } from "@/components/layout/create-flow-skeleton";

export default function AIImagePage() {
  return (
    <Suspense fallback={<CreateFlowSkeleton />}>
      <CreateContent mode="image" />
    </Suspense>
  );
}
