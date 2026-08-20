import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CreateContent } from "./create-content";
import { CreateFlowSkeleton } from "@/components/layout/create-flow-skeleton";

export default function CreateModePage({
  params,
}: {
  params: { mode: string };
}) {
  if (params.mode === "voice") {
    redirect("/ai-image");
  }

  if (params.mode !== "video" && params.mode !== "image") {
    redirect("/ai-image");
  }

  return (
    <Suspense fallback={<CreateFlowSkeleton />}>
      <CreateContent mode={params.mode} />
    </Suspense>
  );
}
