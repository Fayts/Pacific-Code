"use client";

// Colonne gauche de la boîte de réception : liste des conversations,
// tous canaux confondus, avec aperçu du dernier message et statut.

import { Trash2 } from "lucide-react";
import { ConversationStatusBadge } from "@/components/shared/status-badge";
import { ChannelIcon } from "@/components/inbox/channel-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { InboxConversation } from "@/lib/types/inbox";
import { cn } from "@/lib/utils";

export type ConversationListItem = {
  conversation: InboxConversation;
  snippet: string;
  /** L'agent a réuni bien + dates + dispo : convertible en réservation. */
  readyToBook?: boolean;
};

/** « il y a 5 min », « il y a 3 h », sinon la date courte. */
export function relativeTime(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export function ConversationList({
  items,
  selectedId,
  now,
  onSelect,
  onDelete,
}: {
  items: ConversationListItem[];
  selectedId: string | null;
  now: Date;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
}) {
  return (
    <ul className="divide-y divide-border">
      {items.map(({ conversation, snippet, readyToBook }) => {
        const active = conversation.id === selectedId;
        return (
          // La corbeille est un FRÈRE du bouton de ligne (jamais imbriquée :
          // deux <button> emboîtés sont invalides), positionnée par-dessus.
          <li key={conversation.id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={cn(
                "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors",
                onDelete && "pr-9",
                active
                  ? "bg-primary/[0.06]"
                  : "hover:bg-muted/60"
              )}
            >
              <ChannelIcon channel={conversation.channel} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {conversation.customer_name}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {relativeTime(conversation.last_message_at, now)}
                  </span>
                </span>
                {conversation.subject && (
                  <span className="block truncate text-xs font-medium text-foreground/80">
                    {conversation.subject}
                  </span>
                )}
                <span className="block truncate text-xs text-muted-foreground">
                  {snippet}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <ConversationStatusBadge status={conversation.status} />
                  {readyToBook && (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                      Prêt à réserver
                    </span>
                  )}
                </span>
              </span>
            </button>
            {onDelete && (
              <span className="absolute right-1.5 bottom-2.5">
                <ConfirmDialog
                  title="Supprimer cette conversation ?"
                  description={`La conversation avec ${conversation.customer_name} et tous ses messages seront définitivement supprimés.`}
                  confirmLabel="Supprimer"
                  destructive
                  onConfirm={() => onDelete(conversation.id)}
                  trigger={
                    <button
                      type="button"
                      aria-label={`Supprimer la conversation avec ${conversation.customer_name}`}
                      className="rounded-md p-1.5 text-muted-foreground/60 transition hover:bg-destructive/10 hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  }
                />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
