import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarClient } from "@/components/calendar/calendar-client";
import CalendarLoading from "./loading";

export const metadata: Metadata = {
  title: "Calendrier",
};

// Les données viennent de la couche Repository (mock) côté client :
// cette page serveur ne porte que les métadonnées. Le Suspense est requis
// par useSearchParams() dans le composant client.
export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarLoading />}>
      <CalendarClient />
    </Suspense>
  );
}
