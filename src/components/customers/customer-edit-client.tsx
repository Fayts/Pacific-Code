"use client";

// Page « Modifier le client » : charge la fiche depuis la couche de
// données puis affiche le formulaire pré-rempli.

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useAppData } from "@/components/providers/app-data-provider";
import type { Customer } from "@/lib/types/database";
import { formatCustomerName } from "@/lib/core/format";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerForm } from "@/components/customers/customer-form";
import { Skeleton } from "@/components/ui/skeleton";

export function CustomerEditClient({ id }: { id: string }) {
  const { provider, version } = useAppData();
  const [customer, setCustomer] = useState<Customer | null | undefined>(
    undefined
  );

  useEffect(() => {
    let cancelled = false;
    provider.customers.get(id).then((found) => {
      if (!cancelled) setCustomer(found);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, version, id]);

  if (customer === undefined) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (customer === null) {
    notFound();
  }

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
