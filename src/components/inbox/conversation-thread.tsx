"use client";

// Colonne centrale : le fil de la conversation, façon messagerie.
// Messages entrants à gauche, réponses (agent ou loueur) à droite.

import { useEffect, useRef } from "react";
import { Bot, UserRound } from "lucide-react";
import { ChannelLabel } from "@/components/inbox/channel-badge";
import { ConversationStatusBadge } from "@/components/shared/status-badge";
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversation.id]);

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
    </div>
  );
}
