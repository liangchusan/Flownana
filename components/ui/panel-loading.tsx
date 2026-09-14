import { Skeleton } from "@/components/ui/skeleton";

export function PanelLoading() {
  return <div role="status" aria-label="Loading" className="w-full space-y-3 p-4">
    <span className="sr-only">Loading…</span>
    <Skeleton className="h-6 w-1/3" />
    <Skeleton className="h-24 w-full rounded-ui" />
  </div>;
}
