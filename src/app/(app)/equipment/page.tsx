import type { Metadata } from "next";
import { Suspense } from "react";
import { EquipmentListClient } from "@/components/equipment/equipment-list-client";
import EquipmentLoading from "./loading";

export const metadata: Metadata = {
  title: "Matériel",
};

// Les données viennent de la couche Repository (mock) côté client :
// cette page serveur ne porte que les métadonnées. Le Suspense est requis
// par useSearchParams() dans le composant client.
export default function EquipmentPage() {
  return (
    <Suspense fallback={<EquipmentLoading />}>
      <EquipmentListClient />
    </Suspense>
  );
}
