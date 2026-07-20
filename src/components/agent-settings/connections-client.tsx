"use client";

// Page « Assistant IA → Connexions » : connexion des canaux en quelques
// clics, autorisations et personnalité de l'agent, simulation de test et
// activation.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import type { AgentSettings, ChannelConnection } from "@/lib/types/inbox";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelCard } from "@/components/agent-settings/channel-card";
import { AgentConfigForm } from "@/components/agent-settings/agent-config-form";
import { AgentTestCard } from "@/components/agent-settings/agent-test-card";

type PageData = {
  channels: ChannelConnection[];
  settings: AgentSettings;
};

export function ConnectionsClient() {
  const { provider, organization, version } = useAppData();
  const [data, setData] = useState<PageData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([provider.channels.list(), provider.agentSettings.get()]).then(
      ([channels, settings]) => {
        if (!cancelled) setData({ channels, settings });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [provider, version]);

  if (!data || !organization) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const byChannel = new Map(data.channels.map((c) => [c.channel, c]));

  return (
    <div>
      <PageHeader
        title="Agent IA — Connexions"
        description="Connectez vos canaux en quelques clics : votre agent lit les demandes, vérifie les disponibilités et prépare les réponses."
        actions={
          <Button variant="outline" render={<Link href="/inbox" />}>
            <Inbox className="size-4" aria-hidden />
            Boîte de réception
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Étape 1 : les canaux */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            1. Vos canaux
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <ChannelCard
              channel="messenger"
              connection={byChannel.get("messenger") ?? null}
              organization={organization}
            />
            <ChannelCard
              channel="gmail"
              connection={byChannel.get("gmail") ?? null}
              organization={organization}
            />
            <ChannelCard
              channel="whatsapp"
              connection={byChannel.get("whatsapp") ?? null}
              organization={organization}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Le formulaire public de votre espace de réservation est toujours
            actif — ses demandes arrivent aussi dans la boîte de réception.
          </p>
        </section>

        {/* Étape 2 : autorisations + personnalité */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            2. Ce que votre agent est autorisé à faire
          </h2>
          <AgentConfigForm key={data.settings.updated_at} settings={data.settings} />
        </section>

        {/* Étape 3 : test + activation */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            3. Testez, puis activez
          </h2>
          <AgentTestCard settings={data.settings} organization={organization} />
        </section>
      </div>
    </div>
  );
}
