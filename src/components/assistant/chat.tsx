"use client";

// Chat de l'assistant. Deux moteurs derrière la même interface :
// - LLM réel via la route /api/assistant/chat (mode supabase + clé IA
//   configurée côté serveur) — outils bornés, RLS, propositions à
//   confirmer ;
// - moteur déterministe local (mode mock, ou repli sans clé IA).
// La conversation vit en mémoire (non persistée).

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProposalCard } from "@/components/assistant/proposal-card";
import { useAppData } from "@/components/providers/app-data-provider";
import { runDemoAssistant } from "@/lib/ai/demo";
import { createDemoToolkit } from "@/lib/ai/mock-toolkit";
import type { AssistantProposal } from "@/lib/ai/proposals";
import type { Organization } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  proposals?: AssistantProposal[];
};

const SUGGESTIONS = [
  "Quels matériels sont disponibles demain ?",
  "Quelles sont les locations prévues cette semaine ?",
  "Quelles locations sont en retard ?",
  "Combien de réservations avons-nous ce mois-ci ?",
];

// Petit délai artificiel pour un rendu naturel de la réflexion.
const THINKING_DELAY_MS = 350;

// Rendu minimaliste du markdown de l'assistant (gras + listes).
function renderContent(content: string) {
  return content.split("\n").map((line, i) => {
    const withBold = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={j}>{part.slice(2, -2)}</strong>
      ) : (
        <span key={j}>{part}</span>
      )
    );
    return (
      <p key={i} className={cn("min-h-[1em]", line.startsWith("- ") && "pl-3")}>
        {withBold}
      </p>
    );
  });
}

export function AssistantChat({ organization }: { organization: Organization }) {
  const { provider } = useAppData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  // "unknown" tant que la route serveur n'a pas répondu ; "demo" = repli local.
  const [serverAi, setServerAi] = useState<"unknown" | "llm" | "demo">(
    provider.kind === "supabase" ? "unknown" : "demo"
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  const toolkit = useMemo(
    () => createDemoToolkit(provider, organization),
    [provider, organization]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  /** Tente la route LLM serveur ; renvoie false s'il faut le repli local. */
  async function sendToServer(trimmed: string): Promise<boolean> {
    if (
      provider.kind !== "supabase" ||
      serverAi === "demo" ||
      !provider.getAccessToken
    ) {
      return false;
    }
    const token = await provider.getAccessToken();
    if (!token) return false;

    const response = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: trimmed,
        history: messages
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const data = (await response.json()) as
      | { mode: "demo" }
      | { mode: "llm"; text: string; proposals?: AssistantProposal[] }
      | { error: string };

    if ("mode" in data && data.mode === "demo") {
      setServerAi("demo");
      return false;
    }
    if (!response.ok || "error" in data) {
      throw new Error("error" in data ? data.error : "Erreur serveur");
    }
    setServerAi("llm");
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: data.text, proposals: data.proposals ?? [] },
    ]);
    return true;
  }

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || pending) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setPending(true);

    try {
      if (await sendToServer(trimmed)) return;

      const [result] = await Promise.all([
        runDemoAssistant({ organization }, toolkit, trimmed),
        new Promise((resolve) => setTimeout(resolve, THINKING_DELAY_MS)),
      ]);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.text,
          proposals: result.proposals,
        },
      ]);
    } catch (err) {
      const detail =
        err instanceof Error && err.message ? ` (${err.message})` : "";
      toast.error(`L'assistant n'a pas pu répondre.${detail}`);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Une erreur est survenue. Réessayez." },
      ]);
    } finally {
      setPending(false);
    }
  }

  function newConversation() {
    setMessages([]);
  }

  return (
    <div className="flex min-h-[60vh] flex-1 flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="size-4 text-primary" aria-hidden />
          {serverAi === "llm"
            ? "Assistant IA"
            : serverAi === "demo"
              ? "Assistant (mode démo)"
              : "Assistant"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={newConversation}
          disabled={pending || messages.length === 0}
        >
          <RotateCcw className="size-4" aria-hidden />
          Nouvelle conversation
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="size-6 text-primary" aria-hidden />
            </span>
            <div>
              <p className="font-medium">Comment puis-je vous aider ?</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Je consulte vos matériels, clients et réservations, et je peux
                préparer des actions que vous confirmez.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.06] hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index}>
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
                message.role === "user"
                  ? "ml-auto bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white"
                  : "bg-card text-foreground ring-1 ring-pc-deep/[0.08]"
              )}
            >
              {renderContent(message.content)}
            </div>
            {message.proposals && message.proposals.length > 0 && (
              <div className="mt-2 space-y-2">
                {message.proposals.map((proposal, i) => (
                  <ProposalCard
                    key={i}
                    proposal={proposal}
                    currency={organization.currency}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-primary" />
            L&apos;assistant réfléchit…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(input);
            }
          }}
          placeholder="Ex. : Quels matériels sont disponibles samedi ?"
          rows={2}
          className="min-h-0 resize-none"
          disabled={pending}
        />
        <Button type="submit" size="icon" disabled={pending || !input.trim()}>
          <Send className="size-4" aria-hidden />
          <span className="sr-only">Envoyer</span>
        </Button>
      </form>
    </div>
  );
}
