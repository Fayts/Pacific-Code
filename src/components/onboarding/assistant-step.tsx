"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeText, type AnalyzeOutcome } from "@/lib/import/ai";
import { parsePrice } from "@/lib/import/normalize";
import type { ParsedBusiness, ParsedItem } from "@/lib/types/import";

type QuestionId = "name" | "catalog" | "deposit" | "delivery" | "documents";

const QUESTIONS: Array<{ id: QuestionId; text: string; hint?: string }> = [
  { id: "name", text: "Quel est le nom de votre entreprise ?" },
  {
    id: "catalog",
    text: "Que proposez-vous à la location, et à quels tarifs ?",
    hint: "Ex. : « J’ai 5 scooters Honda PCX à 6 000 XPF par jour, 2 voitures à 9 000 XPF et un Puzzi à 7 990 XPF. »",
  },
  {
    id: "deposit",
    text: "Demandez-vous une caution ? Si oui, de combien ?",
    hint: "Ex. : « 20 000 XPF pour le matériel » — ou « non ».",
  },
  {
    id: "delivery",
    text: "Proposez-vous la livraison ? Dans quelles zones ?",
    hint: "Ex. : « Livraison gratuite entre Papenoo et Papeete » — ou « non ».",
  },
  {
    id: "documents",
    text: "Quels documents demandez-vous à vos clients ?",
    hint: "Ex. : « permis de conduire et une pièce d’identité » — ou « aucun ».",
  },
];

type Message = { role: "assistant" | "user"; text: string };

const NEGATIVE = /^(non|no|aucun|aucune|rien|pas de|nope)\b/i;

// Assistant de configuration guidée : questions progressives, réponses en
// langage naturel. Il PRÉPARE un brouillon — il ne crée jamais rien.
export function AssistantStep({
  onComplete,
}: {
  onComplete: (
    items: ParsedItem[],
    business: ParsedBusiness,
    mode: "ai" | "demo"
  ) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Ia ora na ! Je vais préparer votre catalogue en quelques questions. Vous pourrez tout vérifier et corriger avant la création.",
    },
    { role: "assistant", text: QUESTIONS[0].text },
  ]);
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [business, setBusiness] = useState<ParsedBusiness>({
    name: null,
    description: null,
    phone: null,
    email: null,
    address: null,
    deliveryNotes: null,
  });
  const [mode, setMode] = useState<"ai" | "demo">("demo");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const say = (text: string) =>
    setMessages((m) => [...m, { role: "assistant", text }]);

  const submit = async () => {
    const answer = input.trim();
    if (!answer || busy) return;
    setMessages((m) => [...m, { role: "user", text: answer }]);
    setInput("");
    setBusy(true);

    try {
      const question = QUESTIONS[step];
      let nextItems = items;
      const nextBusiness = { ...business };

      if (question.id === "name") {
        nextBusiness.name = answer;
        setBusiness(nextBusiness);
      } else if (question.id === "catalog") {
        const outcome: AnalyzeOutcome = await analyzeText(answer);
        setMode(outcome.mode);
        nextItems = [...items, ...outcome.items];
        setItems(nextItems);
        if (outcome.business.deliveryNotes) {
          nextBusiness.deliveryNotes = outcome.business.deliveryNotes;
          setBusiness(nextBusiness);
        }
        if (outcome.items.length === 0) {
          say(
            "Je n’ai pas réussi à détecter de biens dans cette réponse — vous pourrez les ajouter à la main dans l’écran de vérification."
          );
        } else {
          const withIndividual = outcome.items.filter(
            (i) => i.tracking === "individual" && i.quantity > 1
          );
          say(
            `J’ai préparé ${outcome.items.length} bien${outcome.items.length > 1 ? "s" : ""}.` +
              (withIndividual.length > 0
                ? ` Les véhicules en plusieurs exemplaires seront proposés en fiches individuelles (ex. « ${withIndividual[0].name} 01 », « 02 »…) — vous pourrez basculer en stock groupé à la vérification.`
                : "")
          );
        }
      } else if (question.id === "deposit") {
        if (!NEGATIVE.test(answer)) {
          const amount = parsePrice(answer);
          if (amount !== null && amount > 0) {
            nextItems = items.map((item) =>
              item.depositAmount === null
                ? {
                    ...item,
                    depositAmount: amount,
                    depositConfidence: "probable" as const,
                  }
                : item
            );
            setItems(nextItems);
            say(
              `Noté : caution de ${amount.toLocaleString("fr-FR")} XPF appliquée par défaut — marquée « à confirmer » bien par bien.`
            );
          } else {
            say("Je n’ai pas trouvé de montant — vous pourrez régler les cautions à la vérification.");
          }
        }
      } else if (question.id === "delivery") {
        if (!NEGATIVE.test(answer)) {
          nextBusiness.deliveryNotes = [business.deliveryNotes, answer]
            .filter(Boolean)
            .join(" · ");
          setBusiness(nextBusiness);
        }
      } else if (question.id === "documents") {
        if (!NEGATIVE.test(answer)) {
          nextBusiness.description = [
            business.description,
            `Documents demandés : ${answer}`,
          ]
            .filter(Boolean)
            .join("\n");
          setBusiness(nextBusiness);
        }
      }

      const nextStep = step + 1;
      if (nextStep < QUESTIONS.length) {
        setStep(nextStep);
        say(QUESTIONS[nextStep].text);
      } else {
        say(
          "Parfait, tout est prêt ! Passons à la vérification : rien ne sera créé sans votre validation."
        );
        setTimeout(() => onComplete(nextItems, nextBusiness, mode), 900);
      }
    } finally {
      setBusy(false);
    }
  };

  const hint = QUESTIONS[step]?.hint;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex h-[60svh] min-h-96 flex-col rounded-2xl bg-card shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="size-4 text-primary" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-foreground">
            Assistant de configuration
          </p>
          {mode === "demo" && (
            <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
              mode démo
            </span>
          )}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((message, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className={
                message.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={
                  message.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-pc-lagoon to-pc-turquoise px-4 py-2.5 text-sm text-white"
                    : "max-w-[85%] rounded-2xl rounded-bl-md bg-card px-4 py-2.5 text-sm text-foreground ring-1 ring-pc-deep/[0.08]"
                }
              >
                {message.text}
              </div>
            </motion.div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Analyse en cours…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-border/70 p-3">
          {hint && (
            <p className="mb-2 px-1 text-xs text-muted-foreground/80">{hint}</p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              rows={2}
              placeholder="Répondez en langage naturel…"
              className="flex-1 resize-none bg-card"
              aria-label="Votre réponse"
            />
            <Button
              type="button"
              size="icon-lg"
              onClick={() => void submit()}
              disabled={busy || !input.trim()}
              className="bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-lagoon/25 hover:brightness-105"
              aria-label="Envoyer"
            >
              <Send className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
