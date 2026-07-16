import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerForm } from "@/components/customers/customer-form";

export const metadata: Metadata = {
  title: "Nouveau client",
};

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Nouveau client"
        description="Ajoutez un client à votre carnet pour lui créer des réservations."
      />
      <CustomerForm />
    </div>
  );
}
