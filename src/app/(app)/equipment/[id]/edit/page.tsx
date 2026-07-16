import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EquipmentForm } from "@/components/equipment/equipment-form";
import { ImageManager } from "@/components/equipment/image-manager";

export default async function EditEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireOrgContext();
  const supabase = await createClient();

  const [{ data: item }, { data: categories }, { data: images }] =
    await Promise.all([
      supabase
        .from("equipment_items")
        .select("*")
        .eq("id", id)
        .eq("organization_id", context.organization.id)
        .maybeSingle(),
      supabase
        .from("equipment_categories")
        .select("id, name")
        .eq("organization_id", context.organization.id)
        .order("name", { ascending: true }),
      supabase
        .from("equipment_images")
        .select("*")
        .eq("equipment_id", id)
        .eq("organization_id", context.organization.id)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  if (!item) notFound();

  return (
    <>
      <PageHeader
        title={`Modifier « ${item.name} »`}
        description="Mettez à jour les informations de ce matériel."
      />
      <div className="max-w-3xl space-y-6">
        <ImageManager equipmentId={item.id} images={images ?? []} />
        <EquipmentForm
          categories={categories ?? []}
          currency={context.organization.currency}
          equipment={item}
        />
      </div>
    </>
  );
}
