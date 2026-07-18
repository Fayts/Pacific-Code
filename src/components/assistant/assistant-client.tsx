"use client";

// Page Assistant : attend l'organisation (couche de données mock) puis
// affiche le chat en mode démonstration.

import { useAppData } from "@/components/providers/app-data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AssistantChat } from "@/components/assistant/chat";

export function AssistantClient() {
  const { organization } = useAppData();

  if (!organization) {
    return (
      <div className="mx-auto flex h-full max-w-3xl flex-col">
        <Skeleton className="mb-2 h-7 w-40" />
        <Skeleton className="mb-6 h-4 w-full max-w-md" />
        <Skeleton className="min-h-[60vh] flex-1 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <PageHeader
        title="Assistant IA"
        description="Mode démonstration : réponses simulées, calculées sur les données de votre espace."
      />
      <AssistantChat organization={organization} />
    </div>
  );
}
