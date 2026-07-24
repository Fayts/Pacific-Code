"use client";

// Colonne droite : ce que l'agent a compris (client, bien, dates, dispo,
// prix, manques) et la réponse qu'il propose. Rien ne part sans action
// du loueur — sauf le bouton « Envoyer automatiquement » quand la
// demande est simple et complète en mode auto.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CalendarCheck,
  CheckCircle2,
  FileText,
  Loader2,
  Send,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  isReadyToBook,
  prepareBookingConversion,
} from "@/lib/ai/booking-conversion";
import { useAppData } from "@/components/providers/app-data-provider";
import type { AgentAnalysis } from "@/lib/ai/agent-engine";
import {
  deliversForReal,
  ignoreConversation,
  sendReply,
  transferConversation,
} from "@/lib/services/inbox-service";
import { formatMoney } from "@/lib/core/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { InboxConversation } from "@/lib/types/inbox";
import type { Organization } from "@/lib/types/database";

const INTENT_LABELS: Record<AgentAnalysis["intent"], string> = {
  rental_request: "Demande de location",
  price_question: "Question de tarif",
  availability_question: "Question de disponibilité",
  practical_question: "Question pratique",
  knowledge_question: "Question courante",
  complaint: "Réclamation",
  cancellation: "Demande d'annulation",
  discount_request: "Demande de remise",
  other: "Autre demande",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function humanPeriod(local: string): string {
  const [date, time] = local.split("T");
  const [, month, day] = date.split("-");
  return `${day}/${month} ${time.replace(":", " h ")}`;
}

export function AgentPanel({
  conversation,
  analysis,
  organization,
}: {
  conversation: InboxConversation;
  analysis: AgentAnalysis | null;
  organization: Organization;
}) {
  const { provider } = useAppData();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const currency = organization.currency;

  const reply = draft ?? analysis?.draftReply ?? "";
  const real = deliversForReal(conversation, provider);
  const readyToBook = isReadyToBook(analysis);

  const convert = async () => {
    if (!analysis || converting) return;
    setConverting(true);
    try {
      const ok = await prepareBookingConversion(conversation, analysis, provider);
      if (!ok) {
        toast.error("Conversion impossible — vérifiez la demande.");
        return;
      }
      router.push("/bookings/new?from=conversation");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Conversion impossible — réessayez."
      );
    } finally {
      setConverting(false);
    }
  };
  const closed =
    conversation.status === "replied" ||
    conversation.status === "auto_replied" ||
    conversation.status === "ignored";

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Action impossible");
        return;
      }
      toast.success(success);
      setDraft(null);
    });
  };

  if (!analysis) {
    return (
      <div className="space-y-4 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Bot className="size-4 text-primary" aria-hidden />
          Analyse de l&apos;agent…
        </p>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bot className="size-4 text-primary" aria-hidden />
          Analyse de l&apos;agent
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
            {INTENT_LABELS[analysis.intent]}
          </span>
          {analysis.complexity === "complex" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
              <AlertTriangle className="size-3" aria-hidden />
              Validation requise
            </span>
          )}
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <dl className="space-y-3">
          <Row label="Client">
            {analysis.customer ? (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-3.5 text-muted-foreground" aria-hidden />
                {analysis.customer.name}
                <span className="text-xs text-emerald-700">(carnet clients)</span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                Non identifié — {conversation.customer_name}
              </span>
            )}
          </Row>

          <Row label="Bien demandé">
            {analysis.equipment ? (
              <>
                {analysis.equipment.name}
                {analysis.candidates.length > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    Alternative{analysis.candidates.length > 1 ? "s" : ""} :{" "}
                    {analysis.candidates.map((c) => c.name).join(", ")}
                  </span>
                )}
              </>
            ) : analysis.candidates.length > 0 ? (
              <span className="text-muted-foreground">
                À préciser ({analysis.candidates.map((c) => c.name).join(" ou ")})
              </span>
            ) : (
              <span className="text-muted-foreground">Non identifié</span>
            )}
          </Row>

          <Row label="Dates et horaires">
            {analysis.period ? (
              <>
                {humanPeriod(analysis.period.startAt)} →{" "}
                {humanPeriod(analysis.period.endAt)}
                {analysis.durationDays && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({analysis.durationDays} jour
                    {analysis.durationDays > 1 ? "s" : ""})
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Non précisés</span>
            )}
          </Row>

          <Row label="Disponibilité">
            {analysis.availability ? (
              analysis.availability.available ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Disponible ({analysis.availability.availableQuantity} ex.)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-red-700">
                  <XCircle className="size-4" aria-hidden />
                  {analysis.availability.reason === "maintenance"
                    ? "En maintenance"
                    : analysis.availability.reason === "conflict"
                      ? "Déjà réservé"
                      : "Indisponible"}
                </span>
              )
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </Row>

          <Row label="Prix">
            {analysis.pricing ? (
              <>
                <strong>{formatMoney(analysis.pricing.total, currency)}</strong>{" "}
                <span className="text-muted-foreground">
                  — caution {formatMoney(analysis.pricing.deposit, currency)}
                </span>
              </>
            ) : analysis.equipment ? (
              <span className="text-muted-foreground">
                {formatMoney(analysis.equipment.dailyPrice, currency)}
                {analysis.equipment.pricingMode === "flat"
                  ? " forfait"
                  : " / jour"}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </Row>

          {analysis.knowledge && (
            <Row label="Source de la réponse">
              <span className="text-sm">
                Base de connaissances —{" "}
                <span className="text-muted-foreground">
                  « {analysis.knowledge.question} »
                </span>
              </span>
            </Row>
          )}

          {analysis.missing.length > 0 && (
            <Row label="Informations manquantes">
              <ul className="space-y-0.5 text-sm text-amber-800">
                {analysis.missing.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <AlertTriangle
                      className="mt-0.5 size-3.5 shrink-0"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </Row>
          )}
        </dl>

        {/* Demande mûre : conversion en réservation préremplie */}
        {readyToBook && analysis.equipment && analysis.pricing && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
              <CalendarCheck className="size-4" aria-hidden />
              Prêt à réserver
            </p>
            <p className="mt-1 text-xs text-emerald-800">
              {analysis.equipment.name} ·{" "}
              {analysis.period ? humanPeriod(analysis.period.startAt) : ""} →{" "}
              {analysis.period ? humanPeriod(analysis.period.endAt) : ""} ·{" "}
              <strong>{formatMoney(analysis.pricing.total, currency)}</strong>
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2.5 w-full bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
              disabled={converting}
              onClick={() => void convert()}
            >
              {converting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <CalendarCheck className="size-4" aria-hidden />
              )}
              Créer la réservation
            </Button>
            <p className="mt-1.5 text-center text-[11px] text-emerald-800/80">
              Formulaire prérempli — rien n&apos;est réservé sans votre
              validation.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Réponse proposée
          </p>
          <Textarea
            value={reply}
            onChange={(event) => setDraft(event.target.value)}
            rows={9}
            disabled={pending || closed}
            aria-label="Réponse proposée par l'agent"
          />
          {analysis.autoSendable && conversation.status === "new" && (
            <p className="text-xs text-violet-700">
              Demande simple et complète : l&apos;agent peut l&apos;envoyer sans
              validation (mode automatique).
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 border-t border-border p-3">
        {closed ? (
          <p className="text-center text-xs text-muted-foreground">
            Conversation{" "}
            {conversation.status === "ignored" ? "ignorée" : "traitée"}
            {real ? "." : " — envoi simulé en mode démonstration."}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="col-span-2"
                disabled={pending || !reply.trim()}
                onClick={() =>
                  run(
                    () =>
                      sendReply(
                        {
                          conversationId: conversation.id,
                          body: reply,
                          auto: false,
                        },
                        provider
                      ),
                    real ? "Réponse envoyée" : "Réponse envoyée (simulée)"
                  )
                }
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Send aria-hidden />
                )}
                Valider et envoyer
              </Button>
              {analysis.autoSendable && (
                <Button
                  type="button"
                  variant="secondary"
                  className="col-span-2"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () =>
                        sendReply(
                          {
                            conversationId: conversation.id,
                            body: analysis.draftReply,
                            auto: true,
                          },
                          provider
                        ),
                      real
                        ? "Réponse envoyée automatiquement"
                        : "Réponse envoyée automatiquement (simulée)"
                    )
                  }
                >
                  <Bot aria-hidden />
                  Envoyer automatiquement
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      sendReply(
                        {
                          conversationId: conversation.id,
                          body: `Pour préparer votre réservation, merci de compléter notre formulaire : /reserver/apercu\n\n${organization.name}`,
                          auto: false,
                        },
                        provider
                      ),
                    real ? "Formulaire envoyé" : "Formulaire envoyé (simulé)"
                  )
                }
              >
                <FileText aria-hidden />
                Formulaire
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () => transferConversation(conversation.id, provider),
                    "Conversation transférée au loueur"
                  )
                }
              >
                <ArrowUpRight aria-hidden />
                Transférer
              </Button>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => ignoreConversation(conversation.id, provider),
                  "Conversation ignorée"
                )
              }
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Ignorer cette conversation
            </button>
          </>
        )}
      </div>
    </div>
  );
}
