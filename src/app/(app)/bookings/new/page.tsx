import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BookingNewClient } from "@/components/bookings/booking-new-client";

export const metadata: Metadata = {
  title: "Nouvelle réservation",
};

// Le Suspense est requis par useSearchParams() (présélection ?customer=).
export default function NewBookingPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <BookingNewClient />
    </Suspense>
  );
}
