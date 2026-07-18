import type { Metadata } from "next";
import { CustomerDetailClient } from "@/components/customers/customer-detail-client";

export const metadata: Metadata = {
  title: "Fiche client",
};

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerDetailClient id={id} />;
}
