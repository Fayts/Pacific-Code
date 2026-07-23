"use client";

// Configuration de l'agent : ce qu'il est autorisé à faire, son mode de
// fonctionnement (assisté ou automatique) et sa personnalité.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BellRing, Bot, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateAgentSettings } from "@/lib/services/inbox-service";
import { useAppData } from "@/components/providers/app-data-provider";
import type {
  AgentPermissions,
  AgentSettings,
  AgentTone,
} from "@/lib/types/inbox";

const PERMISSION_LABELS: Array<{
  key: keyof AgentPermissions;
  label: string;
}> = [
  { key: "read_messages", label: "Lire les nouveaux messages" },
  { key: "detect_requests", label: "Détecter les demandes de location" },
  { key: "check_availability", label: "Vérifier les disponibilités" },
  { key: "compute_prices", label: "Calculer les prix" },
  { key: "prepare_replies", label: "Préparer les réponses" },
  {
    key: "auto_reply_simple",
    label: "Répondre automatiquement aux questions simples",
  },
  { key: "send_form", label: "Envoyer le formulaire client" },
];

const TONE_ITEMS: Record<AgentTone, string> = {
  professional: "Professionnel",
  warm: "Chaleureux",
  concise: "Concis",
  premium: "Premium",
};

export function AgentConfigForm({ settings }: { settings: AgentSettings }) {
  const { provider } = useAppData();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState(settings.mode);
  const [tone, setTone] = useState<AgentTone>(settings.tone);
  const [signature, setSignature] = useState(settings.signature);
  const [practicalInfo, setPracticalInfo] = useState(settings.practical_info);
  const [permissions, setPermissions] = useState(settings.permissions);
  const [notifyEnabled, setNotifyEnabled] = useState(
    settings.notify_new_messages
  );
  const [notifyEmail, setNotifyEmail] = useState(settings.notify_email ?? "");

  const save = () => {
    startTransition(async () => {
      const result = await updateAgentSettings(
        {
          mode,
          tone,
          signature,
          practical_info: practicalInfo,
          permissions,
          notify_new_messages: notifyEnabled,
          notify_email: notifyEmail.trim() || null,
        },
        provider
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Réglages de l'agent enregistrés");
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            Autorisations de l&apos;agent
          </CardTitle>
          <CardDescription>
            Cochez ce que l&apos;IA est autorisée à faire. Les demandes
            complexes (réclamation, annulation, remise) restent toujours
            soumises à votre validation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2.5">
            {PERMISSION_LABELS.map(({ key, label }) => (
              <li key={key} className="flex items-center gap-2.5">
                <Checkbox
                  id={`perm-${key}`}
                  checked={permissions[key]}
                  onCheckedChange={(checked) =>
                    setPermissions((prev) => ({
                      ...prev,
                      [key]: checked === true,
                    }))
                  }
                />
                <Label
                  htmlFor={`perm-${key}`}
                  className="text-sm font-normal text-foreground"
                >
                  {label}
                </Label>
              </li>
            ))}
          </ul>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="agent-mode" className="flex items-center gap-1.5">
                <Bot className="size-4 text-primary" aria-hidden />
                Mode automatique
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Activé : l&apos;agent envoie seul les réponses aux demandes
                simples et complètes (tarifs, disponibilités, horaires,
                formulaire). Désactivé (mode assisté) : il prépare tout et
                vous validez chaque envoi.
              </p>
            </div>
            <Switch
              id="agent-mode"
              checked={mode === "auto"}
              onCheckedChange={(checked) =>
                setMode(checked ? "auto" : "assisted")
              }
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label
                  htmlFor="agent-notify"
                  className="flex items-center gap-1.5"
                >
                  <BellRing className="size-4 text-primary" aria-hidden />
                  Alerte email à chaque nouveau message
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Un client vous écrit (Messenger, email, formulaire…) : vous
                  recevez un email avec un lien direct pour répondre. Au plus
                  une alerte par conversation toutes les 30 minutes. Envoyée
                  via votre compte email connecté.
                </p>
              </div>
              <Switch
                id="agent-notify"
                checked={notifyEnabled}
                onCheckedChange={setNotifyEnabled}
              />
            </div>
            {notifyEnabled && (
              <div className="space-y-1.5">
                <Label htmlFor="agent-notify-email" className="text-xs">
                  Adresse des alertes (vide = votre compte connecté)
                </Label>
                <Input
                  id="agent-notify-email"
                  type="email"
                  value={notifyEmail}
                  onChange={(event) => setNotifyEmail(event.target.value)}
                  placeholder="ex. mon-portable@gmail.com"
                  maxLength={200}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personnalité</CardTitle>
          <CardDescription>
            Le ton utilisé dans les réponses, votre signature et les
            informations pratiques que l&apos;agent peut citer — il
            n&apos;invente jamais rien d&apos;autre.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Ton des réponses</Label>
            <Select
              items={TONE_ITEMS}
              value={tone}
              onValueChange={(value) => setTone(value as AgentTone)}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TONE_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-signature">Signature</Label>
            <Input
              id="agent-signature"
              value={signature}
              onChange={(event) => setSignature(event.target.value)}
              placeholder="L'équipe Pacific Rent&Clean"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-practical">
              Informations pratiques (horaires, retrait, livraison…)
            </Label>
            <Textarea
              id="agent-practical"
              rows={4}
              value={practicalInfo}
              onChange={(event) => setPracticalInfo(event.target.value)}
              placeholder="Ex. : Retrait et retour à Papeete, du lundi au samedi de 7 h 30 à 17 h 00…"
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">
              L&apos;agent utilise ce texte pour répondre aux questions
              pratiques. S&apos;il est vide, il transmet la question au
              loueur.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="button" disabled={pending} onClick={save}>
              {pending ? "Enregistrement…" : "Enregistrer les réglages"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
