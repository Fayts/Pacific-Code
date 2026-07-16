import { requireOrgContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EquipmentForm } from "@/components/equipment/equipment-form";

export default async function NewEquipmentPage() {
  const context = await requireOrgContext();
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("equipment_categories")
    .select("id, name")
    .eq("organization_id", context.organization.id)
    .order("name", { ascending: true });

  return (
    <>
      <PageHeader
        title="Nouveau matériel"
        description="Ajoutez un matériel à votre parc de location."
      />
      <EquipmentForm
        categories={categories ?? []}
        currency={context.organization.currency}
      />
    </>
  );
}
