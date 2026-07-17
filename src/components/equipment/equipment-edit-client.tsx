"use client";

// Page « Modifier un matériel » : charge la fiche et les catégories depuis
// la couche de données puis affiche le formulaire pré-rempli. Pas de
// gestion de photos en mode démo (aucun stockage associé).

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useAppData } from "@/components/providers/app-data-provider";
import type { EquipmentCategory, EquipmentItem } from "@/lib/types/database";
import { PageHeader } from "@/components/shared/page-header";
import { EquipmentForm } from "@/components/equipment/equipment-form";
import { Skeleton } from "@/components/ui/skeleton";

type EditData = {
  item: EquipmentItem | null;
  categories: EquipmentCategory[];
};

export function EquipmentEditClient({ id }: { id: string }) {
  const { provider, organization, version } = useAppData();
  const [data, setData] = useState<EditData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([provider.equipment.get(id), provider.categories.list()]).then(
      ([item, categories]) => {
        if (!cancelled) setData({ item, categories });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [provider, version, id]);

  if (!data || !organization) {
    return (
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!data.item) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title={`Modifier « ${data.item.name} »`}
        description="Mettez à jour les informations de ce matériel."
      />
      <div className="max-w-3xl space-y-6">
        <EquipmentForm
          categories={data.categories}
          currency={organization.currency}
          equipment={data.item}
        />
      </div>
    </>
  );
}
