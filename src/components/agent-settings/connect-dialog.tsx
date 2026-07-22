"use client";

// Parcours de connexion d'un canal, SIMULÉ pas-à-pas comme le vrai
// OAuth : choix du compte / de la Page, récapitulatif des autorisations,
// activation automatique des webhooks, confirmation. Aucune configuration
// technique demandée à l'utilisateur — exactement le parcours cible.
// Le vrai OAuth (Meta / Google) remplacera ce dialogue avec le backend.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChannelIcon } from "@/components/inbox/channel-badge";
import { CHANNEL_LABELS } from "@/lib/core/labels";
import { connectChannel } from "@/lib/services/inbox-service";
import { useAppData } from "@/components/providers/app-data-provider";
import type { ChannelKind } from "@/lib/types/inbox";
import type { Organization } from "@/lib/types/database";
import { cn } from "@/lib/utils";

type FlowChannel = Exclude<ChannelKind, "form">;

const FLOWS: Record<
  FlowChannel,
  {
    chooseTitle: string;
    chooseDescription: string;
    permissions: string[];
    webhookNote: string;
  }
> = {
  messenger: {
    chooseTitle: "Choisissez votre Page Facebook",
    chooseDescription:
      "Compte Facebook connecté (simulation). Sélectionnez la Page professionnelle que l'agent doit gérer.",
    permissions: [
      "Lire les messages reçus par la Page (pages_messaging)",
      "Répondre aux conversations Messenger",
      "Voir le nom public des personnes qui vous écrivent",
    ],
    webhookNote:
      "Les webhooks Messenger sont activés automatiquement — rien à configurer.",
  },
  gmail: {
    chooseTitle: "Choisissez votre compte Google",
    chooseDescription:
      "Connexion Google (simulation). L'agent ne lit que les emails liés aux demandes de location.",
    permissions: [
      "Lire les nouveaux emails entrants",
      "Envoyer des réponses en votre nom",
      "Aucun accès aux autres données du compte",
    ],
    webhookNote:
      "La surveillance de la boîte de réception est activée automatiquement.",
  },
  outlook: {
    chooseTitle: "Choisissez votre compte Microsoft",
    chooseDescription:
      "Connexion Microsoft (simulation). L'agent ne lit que les emails liés aux demandes de location.",
    permissions: [
      "Lire les nouveaux emails entrants",
      "Envoyer des réponses en votre nom",
      "Aucun accès aux autres données du compte",
    ],
    webhookNote:
      "La surveillance de la boîte de réception est activée automatiquement.",
  },
  whatsapp: {
    chooseTitle: "Votre numéro WhatsApp Business",
    chooseDescription:
      "Indiquez le numéro professionnel que l'agent doit gérer (connexion complète prévue en V2 — simulée pour l'instant).",
    permissions: [
      "Recevoir les messages WhatsApp entrants",
      "Répondre automatiquement aux conversations",
    ],
    webhookNote:
      "Le raccordement à l'API WhatsApp Business sera automatique.",
  },
};

type Step = "choose" | "permissions" | "connecting" | "done";

export function ChannelConnectDialog({
  channel,
  organization,
  open,
  onOpenChange,
}: {
  channel: FlowChannel;
  organization: Organization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { provider } = useAppData();
  const [, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("choose");

  const options =
    channel === "messenger"
      ? [`${organization.name} — Page Facebook`, `${organization.name} (page secondaire)`]
      : channel === "gmail" || channel === "outlook"
        ? [
            organization.email ?? "contact@entreprise.pf",
            `Utiliser une autre adresse ${channel === "gmail" ? "Gmail" : "Outlook"}`,
          ]
        : [];
  const [selected, setSelected] = useState(0);
  const [phone, setPhone] = useState(organization.phone ?? "");

  const flow = FLOWS[channel];
  const displayName = channel === "whatsapp" ? phone.trim() : options[selected];

  const reset = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) setStep("choose");
  };

  const confirm = () => {
    setStep("connecting");
    startTransition(async () => {
      // Petit délai pour restituer le déroulé du vrai parcours OAuth.
      await new Promise((resolve) => setTimeout(resolve, 900));
      const result = await connectChannel(channel, displayName, provider);
      if (!result.ok) {
        toast.error(result.error);
        setStep("permissions");
        return;
      }
      setStep("done");
    });
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChannelIcon channel={channel} />
            Connecter {CHANNEL_LABELS[channel]}
          </DialogTitle>
          <DialogDescription>
            Parcours simulé en mode démonstration — identique au parcours
            officiel (OAuth) de la version en ligne.
          </DialogDescription>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">{flow.chooseTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {flow.chooseDescription}
              </p>
            </div>
            {channel === "whatsapp" ? (
              <div className="space-y-2">
                <Label htmlFor="wa-phone">Numéro professionnel</Label>
                <Input
                  id="wa-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+689 87 12 34 56"
                />
              </div>
            ) : (
              <ul className="space-y-2">
                {options.map((option, index) => (
                  <li key={option}>
                    <button
                      type="button"
                      onClick={() => setSelected(index)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                        index === selected
                          ? "border-primary/50 bg-primary/[0.06] font-medium"
                          : "border-border hover:bg-muted/60"
                      )}
                    >
                      {option}
                      {index === selected && (
                        <Check className="size-4 text-primary" aria-hidden />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => reset(false)}>
                Annuler
              </Button>
              <Button
                type="button"
                disabled={channel === "whatsapp" && !phone.trim()}
                onClick={() => setStep("permissions")}
              >
                Continuer
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "permissions" && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              L&apos;agent IA sera autorisé à :
            </p>
            <ul className="space-y-1.5">
              {flow.permissions.map((permission) => (
                <li
                  key={permission}
                  className="flex items-start gap-2 text-sm text-foreground/90"
                >
                  <ShieldCheck
                    className="mt-0.5 size-4 shrink-0 text-emerald-600"
                    aria-hidden
                  />
                  {permission}
                </li>
              ))}
            </ul>
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {flow.webhookNote}
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("choose")}
              >
                Retour
              </Button>
              <Button type="button" onClick={confirm}>
                Autoriser et connecter
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "connecting" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Connexion à {CHANNEL_LABELS[channel]} et activation des
              webhooks…
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-3 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="size-5" aria-hidden />
              </span>
              <p className="text-sm font-medium">
                {CHANNEL_LABELS[channel]} connecté !
              </p>
              <p className="text-xs text-muted-foreground">
                {displayName} — les nouvelles demandes arriveront dans votre
                boîte de réception.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" className="w-full" onClick={() => reset(false)}>
                Terminer
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
