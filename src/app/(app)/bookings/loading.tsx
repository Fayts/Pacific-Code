import { Skeleton } from "@/components/ui/skeleton";

export default function BookingsLoading() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-44" />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-8 w-full sm:max-w-xs" />
          <Skeleton className="h-8 w-full sm:w-44" />
          <Skeleton className="h-8 w-full sm:w-44" />
        </div>

        <div className="overflow-hidden rounded-xl bg-card shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
          <div className="border-b border-border/60 px-4 py-3">
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border/60 px-4 py-3 last:border-0"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="hidden h-4 flex-1 md:block" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="hidden h-5 w-20 rounded-md sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
