"use client";

import { Suspense } from "react";
import { CreateContent } from "./create-content";

export default function CreateModePage({
  params,
}: {
  params: { mode: string };
}) {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-white">
        <div className="w-[70px] bg-white"></div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    }>
      <CreateContent mode={params.mode as "video" | "image" | "voice"} />
    </Suspense>
  );
}
