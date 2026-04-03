"use client";

import { Suspense } from "react";
import { CreateContent } from "./create-content";
import { Skeleton } from "@/components/ui/skeleton";

export default function AIVideoPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-white">
        <div className="w-[70px] border-r border-slate-200/60 bg-white p-4 space-y-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
        <div className="flex-1 p-8">
          <div className="grid grid-cols-[440px_1fr] h-full gap-0">
            <div className="border-r border-slate-200/60 p-8 space-y-6">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-52 w-full rounded-2xl" />
              <Skeleton className="h-36 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
            <div className="bg-slate-50 p-8">
              <Skeleton className="h-full w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    }>
      <CreateContent mode="video" />
    </Suspense>
  );
}
