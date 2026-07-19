"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { useAppData } from "@/components/providers/app-data-provider";
import { MethodSelector } from "@/components/onboarding/method-selector";
import { PasteImportStep } from "@/components/onboarding/paste-import-step";
import { FileImportStep } from "@/components/onboarding/file-import-step";
import { AgentStep } from "@/components/onboarding/agent/agent-step";
import { ExpressStep } from "@/components/onboarding/express-step";
import { WebsiteImportStep } from "@/components/onboarding/website-import-step";
import { ReviewStep } from "@/components/onboarding/review-step";
import { SuccessStep } from "@/components/onboarding/success-step";
import type {
  ImportReport,
  ImportSessionData,
  ImportSource,
  ParsedBusiness,
} from "@/lib/types/import";
import type { AnalyzeOutcome } from "@/lib/import/ai";
import { applyDraftToSession } from "@/lib/agent/to-import-session";
import { markDuplicates } from "@/lib/import/duplicates";
import { runImport } from "@/lib/import/import-runner";
import {
  clearSession,
  createSession,
  loadSession,
  saveSession,
} from "@/lib/import/session-store";
import { clearConversation, loadConversation } from "@/lib/agent/store";
import type { EquipmentCategory, EquipmentItem } from "@/lib/types/database";

type Phase = "method" | "input" | "review" | "importing" | "success";

const PHASE_LABELS: Array<{ id: Phase; label: string }> = [
  { id: "method", label: "Méthode" },
  { id: "input", label: "Contenu" },
  { id: "review", label: "Vérification" },
  { id: "success", label: "Terminé" },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export function OnboardingClient() {
  const { provider, session: appSession } = useAppData();
  const userId = appSession?.user.id ?? null;
  const [phase, setPhase] = useState<Phase>("method");
  const [session, setSession] = useState<ImportSessionData | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [resumable, setResumable] = useState<ImportSessionData | null>(null);
  const [agentResumable, setAgentResumable] = useState(false);
  const [existingEquipment, setExistingEquipment] = useState<EquipmentItem[]>([]);
  const [existingCategories, setExistingCategories] = useState<EquipmentCategory[]>([]);
  const importing = phase === "importing";
  const restored = useRef(false);

  // Contexte existant (doublons + catégories) et reprises de brouillons
  // (session d'import et conversation avec l'agent).
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      provider.equipment.list({ includeArchived: false }),
      provider.categories.list(),
    ]).then(([equipment, categories]) => {
      if (cancelled) return;
      setExistingEquipment(equipment);
      setExistingCategories(categories);
      if (!restored.current) {
        restored.current = true;
        const draft = loadSession();
        if (
          draft &&
          (draft.items.length > 0 || draft.extraCategories.length > 0)
        ) {
          setResumable(draft);
        }
        if (userId) {
          const conversation = loadConversation(userId);
          setAgentResumable(
            Boolean(conversation?.messages.some((m) => m.role === "user"))
          );
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [provider, userId]);

  // Sauvegarde automatique du brouillon.
  useEffect(() => {
    if (session && (phase === "input" || phase === "review")) {
      saveSession(session);
    }
  }, [session, phase]);

  const startMethod = (source: ImportSource) => {
    setSession(createSession(source));
    setResumable(null);
    setPhase("input");
  };

  const goToReview = useCallback(
    (
      updater: (base: ImportSessionData) => ImportSessionData,
      outcomeMode?: "ai" | "demo"
    ) => {
      setSession((current) => {
        const base = current ?? createSession("text");
        const next = updater(base);
        return {
          ...next,
          status: "ready_for_review",
          items: markDuplicates(next.items, existingEquipment),
        };
      });
      setPhase("review");
      if (outcomeMode === "demo") {
        toast.info(
          "Analyse en mode démonstration (aucune clé IA configurée) : vérifiez chaque valeur détectée."
        );
      }
    },
    [existingEquipment]
  );

  const applyOutcome = (raw: string, outcome: AnalyzeOutcome) => {
    goToReview(
      (base) => ({
        ...base,
        rawInput: raw,
        items: [...base.items, ...outcome.items],
        business: { ...base.business, ...compactBusiness(outcome.business) },
      }),
      outcome.mode
    );
  };

  const doImport = async () => {
    if (!session) return;
    setPhase("importing");
    const result = await runImport(session, provider);
    if (!result.ok) {
      toast.error(result.error);
      setPhase("review");
      return;
    }
    clearSession();
    // Le brouillon de l'agent est importé : la conversation repart à neuf.
    if (userId) clearConversation(userId);
    setAgentResumable(false);
    setReport(result.data);
    setPhase("success");
  };

  const currentPhaseIndex = useMemo(() => {
    const index = PHASE_LABELS.findIndex((p) => p.id === phase);
    if (phase === "importing") return 2;
    return index === -1 ? 0 : index;
  }, [phase]);

  const wide = phase === "input" && session?.source === "assistant";

  return (
    <div className={wide ? "mx-auto max-w-7xl" : "mx-auto max-w-5xl"}>
      <PageHeader
        title="Créer mon entreprise rapidement"
        description="Importez votre activité en quelques minutes — tout est vérifié avant d’être créé."
        actions={
          phase !== "method" && phase !== "success" && !importing ? (
            <Button
              variant="ghost"
              onClick={() => setPhase(phase === "review" ? "input" : "method")}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Retour
            </Button>
          ) : undefined
        }
      />

      {/* Progression */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          {PHASE_LABELS.map((step, i) => (
            <div key={step.id} className="flex flex-1 items-center gap-2">
              <span
                className={
                  i <= currentPhaseIndex
                    ? "whitespace-nowrap text-xs font-semibold text-primary"
                    : "whitespace-nowrap text-xs text-muted-foreground/60"
                }
              >
                {step.label}
              </span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={false}
                  animate={{
                    width:
                      i < currentPhaseIndex
                        ? "100%"
                        : i === currentPhaseIndex
                          ? "50%"
                          : "0%",
                  }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="h-full rounded-full bg-gradient-to-r from-pc-lagoon to-pc-turquoise"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversation avec l'agent à reprendre */}
      {phase === "method" && agentResumable && !resumable && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.05] px-4 py-3">
          <p className="flex-1 text-sm text-foreground">
            Une conversation avec l’agent IA est en cours — votre brouillon
            vous attend.
          </p>
          <Button
            size="sm"
            onClick={() => {
              setAgentResumable(false);
              startMethod("assistant");
            }}
          >
            Reprendre la conversation
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (userId) clearConversation(userId);
              setAgentResumable(false);
            }}
          >
            Supprimer
          </Button>
        </div>
      )}

      {/* Brouillon à reprendre */}
      {phase === "method" && resumable && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.05] px-4 py-3">
          <p className="flex-1 text-sm text-foreground">
            Un brouillon d’import du{" "}
            {new Date(resumable.updatedAt).toLocaleDateString("fr-FR")} avec{" "}
            {resumable.items.length} bien
            {resumable.items.length > 1 ? "s" : ""} est en attente.
          </p>
          <Button
            size="sm"
            onClick={() => {
              setSession(resumable);
              setResumable(null);
              setPhase("review");
            }}
          >
            Reprendre
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              clearSession();
              setResumable(null);
            }}
          >
            Supprimer
          </Button>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={phase === "importing" ? "review" : phase}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          {phase === "method" && <MethodSelector onSelect={startMethod} />}

          {phase === "input" && session?.source === "text" && (
            <PasteImportStep
              initialText={session.rawInput}
              onAnalyzed={applyOutcome}
            />
          )}
          {phase === "input" && session?.source === "file" && (
            <FileImportStep
              onParsed={(fileName, items) =>
                goToReview((base) => ({
                  ...base,
                  rawInput: fileName,
                  items: [...base.items, ...items],
                }))
              }
            />
          )}
          {phase === "input" && session?.source === "assistant" && (
            <AgentStep
              onReview={(draft) =>
                goToReview((base) => applyDraftToSession(draft, base))
              }
              onUseTextMethod={() => startMethod("text")}
            />
          )}
          {phase === "input" && session?.source === "express" && (
            <ExpressStep
              onSelect={(title, categories) =>
                goToReview((base) => ({
                  ...base,
                  rawInput: title,
                  extraCategories: categories,
                }))
              }
            />
          )}
          {phase === "input" && session?.source === "website" && (
            <WebsiteImportStep onAnalyzed={applyOutcome} />
          )}

          {(phase === "review" || phase === "importing") && session && (
            <div className="relative">
              <ReviewStep
                session={session}
                categoryOptions={existingCategories.map((c) => c.name)}
                onChange={setSession}
                onImport={() => void doImport()}
                onSaveDraft={() => {
                  saveSession(session);
                  toast.success(
                    "Brouillon enregistré — reprenez quand vous voulez depuis cette page."
                  );
                }}
                onBack={() => setPhase("input")}
              />
              {importing && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/80 backdrop-blur-sm">
                  <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
                  <p className="text-sm font-medium text-foreground">
                    Import en cours — création des catégories et des biens…
                  </p>
                </div>
              )}
            </div>
          )}

          {phase === "success" && report && session && (
            <SuccessStep report={report} session={session} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function compactBusiness(
  partial: Partial<ParsedBusiness>
): Partial<ParsedBusiness> {
  const out: Partial<ParsedBusiness> = {};
  for (const [key, value] of Object.entries(partial) as Array<
    [keyof ParsedBusiness, string | null]
  >) {
    if (value != null && value !== "") out[key] = value;
  }
  return out;
}
