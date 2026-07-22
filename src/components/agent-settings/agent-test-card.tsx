"use client";

// Simulation de test avant activation : le loueur colle un message
// client fictif, l'agent montre ce qu'il comprend (bien, dates, dispo,
// prix) et la réponse qu'il enverrait. Rien n'est persisté, sauf si le
// loueur choisit d'ajouter la conversation à sa boîte de réception.

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FlaskConical,
  Inbox,
  Loader2,
  Pause,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppData } from "@/components/providers/app-data-provider";
import { analyzeConversation, type AgentAnalysis } from "@/lib/ai/agent-engine";
import {
  simulateIncomingMessage,
  updateAgentSettings,
} from "@/lib/services/inbox-service";
import { formatMoney } from "@/lib/core/format";
import { CHANNEL_LABELS } from "@/lib/core/labels";
import type {
  AgentSettings,
  ChannelKind,
  InboxConversation,
  InboxMessage,
} from "@/lib/types/inbox";
import type { Organization } from "@/lib/types/database";

const EXAMPLE_MESSAGE =
  "Bonjour, je voudrais louer un Kärcher Puzzi samedi matin jusqu'à dimanche soir. C'est possible ?";

const CHANNEL_ITEMS: Record<Exclude<ChannelKind, "form">, string> = {
  messenger: CHANNEL_LABELS.messenger,
  gmail: CHANNEL_LABELS.gmail,
  outlook: CHANNEL_LABELS.outlook,
  whatsapp: CHANNEL_LABELS.whatsapp,
};

export function AgentTestCard({
  settings,
  organization,
}: {
  settings: AgentSettings;
  organization: Organization;
}) {
  const { provider } = useAppData();
  const [pending, startTransition] = useTransition();
  const [channel, setChannel] = useState<Exclude<ChannelKind, "form">>(
    "messenger"
  );
  const [message, setMessage] = useState(EXAMPLE_MESSAGE);
  const [result, setResult] = useState<AgentAnalysis | null>(null);
  const [running, setRunning] = useState(false);

  const active = settings.activated_at !== null;

  const runSimulation = async () => {
    const body = message.trim();
    if (!body) return;
    setRunning(true);
    try {
      const nowIso = new Date().toISOString();
      // Conversation éphémère : analysée, jamais persistée.
      const conversation: InboxConversation = {
        id: "00000000-0000-4000-8000-simulation00",
        organization_id: organization.id,
        channel,
        customer_name: "Client de test",
        customer_contact: null,
        customer_id: null,
        subject: null,
        status: "new",
        last_message_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };
      const inbound: InboxMessage = {
        id: "00000000-0000-4000-8000-simulation01",
        organization_id: organization.id,
        conversation_id: conversation.id,
        direction: "inbound",
        author: "customer",
        body,
        created_at: nowIso,
      };
      const analysis = await analyzeConversation(
        { conversation, messages: [inbound] },
        { provider, organization, settings }
      );
      setResult(analysis);
    } finally {
      setRunning(false);
    }
  };

  const addToInbox = () => {
    startTransition(async () => {
      const sent = await simulateIncomingMessage(
        {
          channel,
          customerName: "Client de test",
          body: message.trim(),
        },
        provider
      );
      if (!sent.ok) {
        toast.error(sent.error);
        return;
      }
      toast.success("Conversation ajoutée à la boîte de réception");
    });
  };

  const toggleActivation = () => {
    startTransition(async () => {
      const result = await updateAgentSettings(
        { activated_at: active ? null : new Date().toISOString() },
        provider
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        active
          ? "Assistant IA mis en pause"
          : "Assistant IA activé — il analyse maintenant vos nouvelles demandes 🎉"
      );
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" aria-hidden />
          Tester mon assistant
        </CardTitle>
        <CardDescription>
          Collez un message client fictif : l&apos;agent montre ce qu&apos;il
          comprend, le prix trouvé, la disponibilité et la réponse qu&apos;il
          enverrait. Rien n&apos;est envoyé.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="space-y-2">
            <Label>Canal simulé</Label>
            <Select
              items={CHANNEL_ITEMS}
              value={channel}
              onValueChange={(value) =>
                setChannel(value as Exclude<ChannelKind, "form">)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHANNEL_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sim-message">Message du client</Label>
            <Textarea
              id="sim-message"
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={running || !message.trim()}
            onClick={runSimulation}
          >
            {running ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Bot aria-hidden />
            )}
            Lancer la simulation
          </Button>
          {result && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={addToInbox}
            >
              <Inbox aria-hidden />
              Ajouter à la boîte de réception
            </Button>
          )}
        </div>

        {result && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Ce que l&apos;agent a compris
            </p>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Bien demandé</dt>
                <dd>
                  {result.equipment?.name ?? (
                    <span className="text-muted-foreground">À préciser</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Période</dt>
                <dd>
                  {result.period ? (
                    <>
                      {result.period.label}
                      {result.durationDays &&
                        ` (${result.durationDays} jour${result.durationDays > 1 ? "s" : ""})`}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Non précisée</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Disponibilité</dt>
                <dd>
                  {result.availability ? (
                    result.availability.available ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        Disponible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <XCircle className="size-3.5" aria-hidden />
                        Indisponible
                      </span>
                    )
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Prix trouvé</dt>
                <dd>
                  {result.pricing
                    ? `${formatMoney(result.pricing.total, organization.currency)} (caution ${formatMoney(result.pricing.deposit, organization.currency)})`
                    : "—"}
                </dd>
              </div>
            </dl>
            {result.missing.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                À compléter : {result.missing.join(", ")}
              </p>
            )}
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Réponse générée
              </p>
              <div className="rounded-lg bg-card p-3 text-sm whitespace-pre-wrap ring-1 ring-pc-deep/[0.08]">
                {result.draftReply}
              </div>
            </div>
          </div>
        )}

        {/* Activation */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3.5">
          {active ? (
            <>
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="size-4" aria-hidden />
                Votre Assistant IA est <strong>actif</strong> : il analyse
                chaque nouvelle demande.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={toggleActivation}
              >
                <Pause aria-hidden />
                Mettre en pause
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                L&apos;assistant est en pause : les demandes arrivent sans
                analyse ni réponse automatique.
              </p>
              <Button type="button" disabled={pending} onClick={toggleActivation}>
                <Sparkles aria-hidden />
                Activer mon Assistant IA
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Boîte de réception :{" "}
          <Link href="/inbox" className="text-primary hover:underline">
            voir les conversations
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
