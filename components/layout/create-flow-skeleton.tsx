import { Skeleton } from "@/components/ui/skeleton";

/** 创作页（侧栏 + 表单 + 结果区）Suspense 占位，符合全站 Skeleton 加载规范 */
export function CreateFlowSkeleton() {
  return (
    <div className="flex h-screen bg-[#FDFDF9]">
      <div className="w-16 space-y-4 border-r border-stone-200/50 bg-[#FDFDF9] p-4">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <div className="flex-1 p-8">
        <div className="grid h-full grid-cols-[minmax(0,28rem)_1fr] gap-0">
          <div className="space-y-6 overflow-hidden border-r border-stone-200/50 p-8">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-36 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          <div className="bg-[#FDFDF9] p-8">
            <Skeleton className="h-full min-h-[280px] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
