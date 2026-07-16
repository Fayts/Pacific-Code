import type { Metadata } from "next";
import { Suspense } from "react";
import { ReservationWizard } from "./reservation-wizard";

export const metadata: Metadata = { title: "Réserver" };

export default function ReservationPage() {
  return (
    <Suspense>
      <ReservationWizard />
    </Suspense>
  );
}
