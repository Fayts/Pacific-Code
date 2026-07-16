import { Skeleton } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Skeleton className="h-8 w-full sm:w-72" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-5 w-32" />
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 bg-neutral-50/60 px-4 py-3">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="divide-y divide-neutral-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="hidden h-4 w-28 md:block" />
              <Skeleton className="hidden h-4 w-48 lg:block" />
              <Skeleton className="ml-auto h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
