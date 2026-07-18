import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingNewClient } from "@/components/bookings/booking-new-client";

export const metadata: Metadata = {
  title: "Nouvelle réservation",
};

// Le Suspense est requis par useSearchParams() (présélection ?customer=).
export default function NewBookingPage() {
  return (
    <Suspense fallback={null}>
      <BookingNewClient />
    </Suspense>
  );
}
