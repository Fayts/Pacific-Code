"use client";

// Carte de connexion d'un canal (Messenger, Gmail, WhatsApp) : état,
// connexion en quelques clics, déconnexion avec confirmation.

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ChannelIcon } from "@/components/inbox/channel-badge";
import { ChannelConnectDialog } from "@/components/agent-settings/connect-dialog";
import { CHANNEL_LABELS } from "@/lib/core/labels";
import { disconnectChannel } from "@/lib/services/inbox-service";
import { useAppData } from "@/components/providers/app-data-provider";
import type { ChannelConnection, ChannelKind } from "@/lib/types/inbox";
import type { Organization } from "@/lib/types/database";

const CARD_TEXTS: Record<
  Exclude<ChannelKind, "form">,
  { title: string; description: string; cta: string }
> = {
  messenger: {
    title: "Facebook Messenger",
    description:
      "Connectez votre Page Facebook afin que l'agent IA puisse traiter automatiquement les demandes reçues sur Messenger.",
    cta: "Connecter Facebook",
  },
  gmail: {
    title: "Gmail Professionnel",
    description:
      "Connectez votre boîte mail afin que l'agent IA détecte automatiquement les demandes de location.",
    cta: "Connecter Gmail",
  },
  whatsapp: {
    title: "WhatsApp Business",
    description:
      "Connectez votre numéro professionnel afin que l'agent IA puisse répondre automatiquement aux demandes WhatsApp.",
    cta: "Connecter WhatsApp",
  },
};

export function ChannelCard({
  channel,
  connection,
  organization,
}: {
  channel: Exclude<ChannelKind, "form">;
  connection: ChannelConnection | null;
  organization: Organization;
}) {
  const { provider } = useAppData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const texts = CARD_TEXTS[channel];
  const connected = connection?.status === "connected";

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-3">
          <ChannelIcon channel={channel} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {texts.title}
            </p>
            {channel === "whatsapp" && (
              <p className="text-[11px] font-medium text-muted-foreground">
                Bientôt — parcours simulé
              </p>
            )}
          </div>
        </div>

        <p className="flex-1 text-sm text-muted-foreground">
          {texts.description}
        </p>

        {connected ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircle2 className="size-4" aria-hidden />
              <span className="truncate">
                Connecté — {connection?.display_name}
              </span>
            </p>
            <ConfirmDialog
              trigger={
                <Button type="button" variant="outline" size="sm">
                  Déconnecter
                </Button>
              }
              title={`Déconnecter ${CHANNEL_LABELS[channel]} ?`}
              description="L'agent IA ne recevra plus les demandes de ce canal tant qu'il ne sera pas reconnecté."
              confirmLabel="Déconnecter"
              destructive
              onConfirm={async () => {
                const result = await disconnectChannel(channel, provider);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(`${CHANNEL_LABELS[channel]} déconnecté`);
              }}
            />
          </div>
        ) : (
          <Button type="button" onClick={() => setDialogOpen(true)}>
            {texts.cta}
          </Button>
        )}

        <ChannelConnectDialog
          channel={channel}
          organization={organization}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </CardContent>
    </Card>
  );
}
