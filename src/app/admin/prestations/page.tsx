import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/shell";
import { CatalogAdminGrid } from "@/components/admin/catalog-admin";
import { Button } from "@/components/ui";
import { PRESTATIONS } from "@/lib/data";

export const metadata: Metadata = { title: "Prestations" };

export default function AdminServicesPage() {
  return (
    <>
      <AdminPageHeader
        title="Prestations"
        description="Services de nettoyage à domicile : tarifs et durées d'intervention."
        action={<Button variant="accent" size="sm">+ Ajouter une prestation</Button>}
      />
      <CatalogAdminGrid items={PRESTATIONS} />
    </>
  );
}
