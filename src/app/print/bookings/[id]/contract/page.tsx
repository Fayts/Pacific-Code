import type { Metadata } from "next";
import { BookingPrint } from "@/components/documents/booking-print";

export const metadata: Metadata = {
  title: "Contrat de location",
};

export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookingPrint id={id} kind="contract" />;
}
