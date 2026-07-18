import type { Metadata } from "next";
import { CustomerEditClient } from "@/components/customers/customer-edit-client";

export const metadata: Metadata = {
  title: "Modifier le client",
};

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerEditClient id={id} />;
}
