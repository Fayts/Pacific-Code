"use client";

// Colonne centrale : le fil de la conversation, façon messagerie.
// Messages entrants à gauche, réponses (agent ou loueur) à droite,
// et une zone de réponse manuelle en bas du fil.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bot, Loader2, Send, UserRound } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChannelLabel } from "@/components/inbox/channel-badge";
import { ConversationStatusBadge } from "@/components/shared/status-badge";
import { deliversForReal, sendReply } from "@/lib/services/inbox-service";
import { formatDateTime } from "@/lib/core/format";
import type { InboxConversation, InboxMessage } from "@/lib/types/inbox";
import { cn } from "@/lib/utils";

export function ConversationThread({
  conversation,
  messages,
  timezone,
}: {
  conversation: InboxConversation;
  messages: InboxMessage[];
  timezone: string;
}) {
  const { provider } = useAppData();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const real = deliversForReal(conversation, provider);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversation.id]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const result = await sendReply(
      { conversationId: conversation.id, body, auto: false },
      provider
    );
    setSending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Envoi impossible — réessayez.");
      return;
    }
    setDraft("");
    toast.success(real ? "Réponse envoyée" : "Réponse enregistrée (simulation)");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* En-tête du fil */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {conversation.customer_name}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <ChannelLabel channel={conversation.channel} />
              {conversation.customer_contact && (
                <span className="truncate">{conversation.customer_contact}</span>
              )}
            </p>
          </div>
          <ConversationStatusBadge status={conversation.status} />
        </div>
        {conversation.subject && (
          <p className="mt-1 truncate text-sm text-foreground/80">
            Objet : {conversation.subject}
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message) => {
          const outbound = message.direction === "outbound";
          return (
            <div key={message.id} className={cn(outbound && "flex justify-end")}>
              <div className="max-w-[85%]">
                <div
                  className={cn(
                    "rounded-lg px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                    outbound
                      ? "bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white"
                      : "bg-card text-foreground ring-1 ring-pc-deep/[0.08]"
                  )}
                >
                  {message.body}
                </div>
                <p
                  className={cn(
                    "mt-1 flex items-center gap-1 text-[11px] text-muted-foreground",
                    outbound && "justify-end"
                  )}
                >
                  {outbound &&
                    (message.author === "agent" ? (
                      <>
                        <Bot className="size-3" aria-hidden />
                        Agent IA
                      </>
                    ) : (
                      <>
                        <UserRound className="size-3" aria-hidden />
                        Vous
                      </>
                    ))}
                  <span>{formatDateTime(message.created_at, timezone)}</span>
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Réponse manuelle */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder={`Répondre à ${conversation.customer_name}…`}
            className="max-h-32 flex-1 resize-none bg-card"
            aria-label="Votre réponse"
            disabled={sending}
          />
          <Button
            type="button"
            size="icon-lg"
            onClick={() => void send()}
            disabled={sending || !draft.trim()}
            className="bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-lagoon/25 hover:brightness-105"
            aria-label="Envoyer la réponse"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          {real
            ? `Votre réponse part réellement sur ${conversation.channel === "messenger" ? "Messenger" : "la boîte e-mail du client"}, dans le fil d'origine.`
            : "Canal simulé : la réponse est enregistrée dans le fil sans être délivrée au client."}
        </p>
      </div>
    </div>
  );
}
