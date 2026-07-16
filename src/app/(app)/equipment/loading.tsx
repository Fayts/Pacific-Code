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

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="divide-y divide-neutral-100">
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
