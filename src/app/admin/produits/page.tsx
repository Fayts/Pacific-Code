import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/shell";
import { CatalogAdminGrid } from "@/components/admin/catalog-admin";
import { Button } from "@/components/ui";
import { LOCATIONS } from "@/lib/data";

export const metadata: Metadata = { title: "Produits" };

export default function AdminProductsPage() {
  return (
    <>
      <AdminPageHeader
        title="Produits — locations"
        description="Matériel proposé à la location : tarifs, cautions et disponibilité."
        action={<Button variant="accent" size="sm">+ Ajouter un produit</Button>}
      />
      <CatalogAdminGrid items={LOCATIONS} />
    </>
  );
}
