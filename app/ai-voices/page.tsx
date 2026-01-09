"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AIVoicesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/create?mode=voice");
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-600">Redirecting...</div>
    </div>
  );
}
