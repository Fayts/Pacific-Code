import type { Metadata } from "next";
import { EquipmentNewClient } from "@/components/equipment/equipment-new-client";

export const metadata: Metadata = {
  title: "Nouveau matériel",
};

export default function NewEquipmentPage() {
  return <EquipmentNewClient />;
}
