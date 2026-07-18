"use client";

// Page Paramètres : organisation chargée depuis la couche de données
// (mode mock). Le logo nécessitera le stockage en ligne — remplacé par
// une note de démonstration.

import Link from "next/link";
import { Upload } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsForm } from "@/app/(app)/settings/settings-form";
import { DemoDataCard } from "@/components/settings/demo-data-card";

export function SettingsClient() {
  const { organization } = useAppData();

  if (!organization) {
    return (
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Paramètres"
        description="Coordonnées de votre entreprise, formats d'affichage et numérotation des réservations."
        actions={
          <Button variant="outline" render={<Link href="/onboarding" />}>
            <Upload className="size-4" aria-hidden />
            Importer mon activité
          </Button>
        }
      />

      <div className="space-y-6">
        <SettingsForm organization={organization} />
        <DemoDataCard />
        <p className="text-sm text-muted-foreground">
          Version de démonstration : l&apos;ajout d&apos;un logo sera disponible
          une fois le stockage en ligne connecté.
        </p>
      </div>
    </div>
  );
}
