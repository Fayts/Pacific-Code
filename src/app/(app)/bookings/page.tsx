import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingsListClient } from "@/components/bookings/bookings-list-client";
import BookingsLoading from "./loading";

export const metadata: Metadata = {
  title: "Réservations",
};

// Les données viennent de la couche Repository (mock) côté client :
// cette page serveur ne porte que les métadonnées. Le Suspense est requis
// par useSearchParams() dans le composant client.
export default function BookingsPage() {
  return (
    <Suspense fallback={<BookingsLoading />}>
      <BookingsListClient />
    </Suspense>
  );
}
