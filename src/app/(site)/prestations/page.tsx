import type { Metadata } from "next";
import { CatalogPage } from "@/components/site/catalog-page";
import { PRESTATIONS } from "@/lib/data";

export const metadata: Metadata = { title: "Prestations à domicile" };

export default function PrestationsPage() {
  return (
    <CatalogPage
      eyebrow="Catalogue"
      title="Prestations à domicile"
      description="Nos techniciens se déplacent chez vous avec le matériel professionnel. Devis clair, produits sûrs pour les enfants et les animaux, résultats garantis."
      items={PRESTATIONS}
      note="💡 Le déplacement est inclus entre Papenoo et Papeete. Supplément de 1 500 XPF au-delà de la zone. Les tarifs indiqués correspondent aux formats standards — un ajustement peut être proposé sur place pour les grandes tailles."
    />
  );
}
