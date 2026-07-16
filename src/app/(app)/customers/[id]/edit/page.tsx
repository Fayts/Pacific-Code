import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { formatCustomerName } from "@/lib/core/format";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerForm } from "@/components/customers/customer-form";

export const metadata: Metadata = {
  title: "Modifier le client",
};

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireOrgContext();
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Modifier le client"
        description={formatCustomerName(customer)}
      />
      <CustomerForm customer={customer} />
    </div>
  );
}
