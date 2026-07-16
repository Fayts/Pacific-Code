// Squelette de chargement du calendrier : en-tête, barre d'outils et grille.

import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-6 w-32" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="hidden h-8 w-44 sm:block" />
          <Skeleton className="hidden h-8 w-40 sm:block" />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="grid grid-cols-7 gap-px border-b border-neutral-200 bg-neutral-50 p-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="mx-auto h-3 w-8" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-neutral-200">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-14 bg-white p-1.5 sm:min-h-28">
              <div className="flex justify-end">
                <Skeleton className="size-6 rounded-full" />
              </div>
              {i % 3 === 0 && <Skeleton className="mt-2 hidden h-4 sm:block" />}
              {i % 4 === 0 && <Skeleton className="mt-1 hidden h-4 sm:block" />}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
    </div>
  );
}
