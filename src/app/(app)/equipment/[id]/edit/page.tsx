import type { Metadata } from "next";
import { EquipmentEditClient } from "@/components/equipment/equipment-edit-client";

export const metadata: Metadata = {
  title: "Modifier un matériel",
};

export default async function EditEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EquipmentEditClient id={id} />;
}
