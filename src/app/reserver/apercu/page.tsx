import type { Metadata } from "next";
import { PublicCatalogClient } from "@/app/reserver/apercu/public-catalog-client";

export const metadata: Metadata = {
  title: "Espace de réservation",
};

// Aperçu du futur espace public de réservation.
// En mode démonstration (données dans le navigateur), cet aperçu n'est
// visible que sur l'appareil du loueur ; en mode cloud il deviendra la
// vraie page publique par entreprise.
export default function PublicPreviewPage() {
  return <PublicCatalogClient />;
}
