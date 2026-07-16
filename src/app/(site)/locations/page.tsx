import type { Metadata } from "next";
import { CatalogPage } from "@/components/site/catalog-page";
import { LOCATIONS } from "@/lib/data";

export const metadata: Metadata = { title: "Location de matériel" };

export default function LocationsPage() {
  return (
    <CatalogPage
      eyebrow="Catalogue"
      title="Location de matériel"
      description="Du matériel professionnel Kärcher, livré prêt à l'emploi avec détergent et accessoires. Une caution est demandée à la remise du matériel et restituée au retour."
      items={LOCATIONS}
      note="💡 Livraison et récupération incluses entre Papenoo et Papeete. Supplément de 1 500 XPF au-delà de la zone. Retrait gratuit possible à notre dépôt de Papeete."
    />
  );
}
