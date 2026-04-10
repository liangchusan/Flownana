"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export default function GeneratePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/ai-image");
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#FDFDF9] px-6 py-8">
      <Skeleton className="h-12 w-56 rounded-xl" />
      <Skeleton className="h-4 w-36 rounded-xl" />
    </div>
  );
}

