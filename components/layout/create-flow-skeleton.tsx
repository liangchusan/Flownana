import { Skeleton } from "@/components/ui/skeleton";

/** 创作页（侧栏 + 表单 + 结果区）Suspense 占位，符合全站 Skeleton 加载规范 */
export function CreateFlowSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="flex h-dvh overflow-hidden bg-background">
      <span className="sr-only">Loading page…</span>
      <div aria-hidden="true" className="hidden w-[260px] shrink-0 space-y-4 bg-surface-soft p-5 lg:block">
        <Skeleton className="mb-8 h-6 w-24" />
        <Skeleton className="h-10 w-full rounded-ui" />
        <Skeleton className="h-10 w-full rounded-ui" />
        <Skeleton className="h-10 w-full rounded-ui" />
      </div>
      <div aria-hidden="true" className="flex min-w-0 flex-1 flex-col p-4 md:p-8">
        <Skeleton className="mb-8 h-10 w-10 rounded-ui lg:hidden" />
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6">
          <Skeleton className="h-8 w-1/2 max-w-xs" />
          <Skeleton className="min-h-40 w-full flex-1 rounded-ui-xl" />
          <Skeleton className="h-40 w-full shrink-0 rounded-ui-xl" />
        </div>
      </div>
    </div>
  );
}
