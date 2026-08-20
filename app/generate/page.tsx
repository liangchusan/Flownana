"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  COMPOSER_TYPE_STORAGE_KEY,
  parseComposerPreference,
} from "@/lib/composer-preference";

export default function GeneratePage() {
  const router = useRouter();

  useEffect(() => {
    const preferredType = parseComposerPreference(
      window.localStorage.getItem(COMPOSER_TYPE_STORAGE_KEY)
    );
    router.replace(preferredType === "image" ? "/ai-image" : "/ai-video");
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-8">
      <Skeleton className="h-12 w-56 rounded-xl" />
      <Skeleton className="h-4 w-36 rounded-xl" />
    </div>
  );
}
