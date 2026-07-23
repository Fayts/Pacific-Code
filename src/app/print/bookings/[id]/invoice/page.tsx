import type { Metadata } from "next";
import { BookingPrint } from "@/components/documents/booking-print";

export const metadata: Metadata = {
  title: "Facture",
};

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookingPrint id={id} kind="invoice" />;
}
