"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProposalCard } from "@/components/assistant/proposal-card";
import type {
  AssistantChatResponse,
  AssistantProposal,
} from "@/lib/ai/proposals";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  proposals?: AssistantProposal[];
  /** Les propositions issues de l'historique ne sont plus confirmables. */
  stale?: boolean;
};

const SUGGESTIONS = [
  "Quels matériels sont disponibles demain ?",
  "Quelles sont les locations prévues cette semaine ?",
  "Quelles locations sont en retard ?",
  "Combien de réservations avons-nous ce mois-ci ?",
];

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

export function AssistantChat({
  conversationId: initialConversationId,
  initialMessages,
  currency,
  demoMode,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  currency: string;
  demoMode: boolean;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || pending) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setPending(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: trimmed }),
      });
      const data = (await res.json()) as
        | AssistantChatResponse
        | { error: string };

      if (!res.ok || "error" in data) {
        const errorMessage =
          "error" in data ? data.error : "Une erreur est survenue";
        toast.error(errorMessage);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ ${errorMessage}`,
          },
        ]);
        return;
      }

      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.text, proposals: data.proposals },
      ]);
    } catch {
      toast.error("Connexion impossible. Réessayez.");
    } finally {
      setPending(false);
    }
  }

  function newConversation() {
    setConversationId(null);
    setMessages([]);
  }

  return (
    <div className="flex min-h-[60vh] flex-1 flex-col rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
        <span className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <Sparkles className="size-4 text-sky-700" aria-hidden />
          {demoMode ? "Assistant (mode démo)" : "Assistant"}
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
            <span className="flex size-12 items-center justify-center rounded-full bg-sky-50">
              <Sparkles className="size-6 text-sky-700" aria-hidden />
            </span>
            <div>
              <p className="font-medium">Comment puis-je vous aider ?</p>
              <p className="mt-1 text-sm text-neutral-500 max-w-sm">
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
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-sky-50 hover:border-sky-200 hover:text-sky-800"
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
                  ? "ml-auto bg-sky-700 text-white"
                  : "bg-neutral-100 text-neutral-900"
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
                    currency={currency}
                    stale={message.stale}
                    onDone={() => router.refresh()}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {pending && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <span className="size-2 animate-pulse rounded-full bg-sky-600" />
            L&apos;assistant réfléchit…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-neutral-200 p-3"
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
