import { Skeleton } from "@/components/ui/skeleton";

export default function EquipmentLoading() {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-44" />
      </div>

      <Skeleton className="mb-4 h-14 w-full rounded-lg" />

      <div className="overflow-hidden rounded-xl bg-card shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
        <div className="divide-y divide-border/60">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 p-3">
              <Skeleton className="size-11 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/5" />
              </div>
              <Skeleton className="hidden h-5 w-24 md:block" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
