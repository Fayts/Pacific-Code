import type { Metadata } from "next";
import { EquipmentDetailClient } from "@/components/equipment/equipment-detail-client";

export const metadata: Metadata = {
  title: "Matériel",
};

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EquipmentDetailClient id={id} />;
}
