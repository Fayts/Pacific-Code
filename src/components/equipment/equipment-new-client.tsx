"use client";

// Page « Nouveau matériel » : charge les catégories depuis la couche de
// données puis affiche le formulaire.

import { useEffect, useState } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import type { EquipmentCategory } from "@/lib/types/database";
import { PageHeader } from "@/components/shared/page-header";
import { EquipmentForm } from "@/components/equipment/equipment-form";
import { Skeleton } from "@/components/ui/skeleton";

export function EquipmentNewClient() {
  const { provider, organization, version } = useAppData();
  const [categories, setCategories] = useState<EquipmentCategory[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    provider.categories.list().then((list) => {
      if (!cancelled) setCategories(list);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, version]);

  if (!categories || !organization) {
    return (
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Nouveau matériel"
        description="Ajoutez un matériel à votre parc de location."
      />
      <EquipmentForm
        categories={categories}
        currency={organization.currency}
      />
    </>
  );
}
