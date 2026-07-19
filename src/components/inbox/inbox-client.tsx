"use client";

// Boîte de réception unifiée de l'Agent IA commercial : tous les canaux
// (Messenger, Gmail, WhatsApp, formulaire) au même endroit. Trois
// colonnes : conversations, fil de discussion, analyse de l'agent.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Inbox, Plug } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import { analyzeConversation, type AgentAnalysis } from "@/lib/ai/agent-engine";
import type { AgentSettings, InboxMessage } from "@/lib/types/inbox";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ConversationList,
  type ConversationListItem,
} from "@/components/inbox/conversation-list";
import { ConversationThread } from "@/components/inbox/conversation-thread";
import { AgentPanel } from "@/components/inbox/agent-panel";
import { cn } from "@/lib/utils";

type InboxData = {
  items: ConversationListItem[];
  settings: AgentSettings;
};

const PANEL_CLASS =
  "overflow-hidden rounded-xl bg-card shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]";

export function InboxClient() {
  const { provider, organization, version } = useAppData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<InboxData | null>(null);
  // États indexés par conversation : une donnée d'un autre fil est
  // simplement ignorée au rendu (pas de remise à zéro synchrone).
  const [thread, setThread] = useState<{
    id: string;
    messages: InboxMessage[];
  } | null>(null);
  const [analysisState, setAnalysisState] = useState<{
    id: string;
    result: AgentAnalysis;
  } | null>(null);

  const selectedId = searchParams.get("c");

  // Conversations + aperçus (dernier message de chaque fil).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [conversations, settings] = await Promise.all([
        provider.inbox.listConversations(),
        provider.agentSettings.get(),
      ]);
      const items = await Promise.all(
        conversations.map(async (conversation) => {
          const thread = await provider.inbox.listMessages(conversation.id);
          const last = thread[thread.length - 1];
          return {
            conversation,
            snippet: last ? last.body.replace(/\s+/g, " ") : "",
          };
        })
      );
      if (!cancelled) setData({ items, settings });
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, version]);

  // Fil + analyse de la conversation sélectionnée.
  useEffect(() => {
    if (!selectedId || !organization) return;
    let cancelled = false;
    (async () => {
      const [conversation, messages, settings] = await Promise.all([
        provider.inbox.getConversation(selectedId),
        provider.inbox.listMessages(selectedId),
        provider.agentSettings.get(),
      ]);
      if (cancelled) return;
      setThread({ id: selectedId, messages });
      if (!conversation) return;
      const result = await analyzeConversation(
        { conversation, messages },
        { provider, organization, settings }
      );
      if (!cancelled) setAnalysisState({ id: selectedId, result });
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, version, selectedId, organization]);

  if (!data || !organization) {
    return (
      <div>
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  const selected =
    data.items.find((item) => item.conversation.id === selectedId)
      ?.conversation ?? null;
  const messages =
    thread && thread.id === selectedId ? thread.messages : null;
  const analysis =
    analysisState && analysisState.id === selectedId
      ? analysisState.result
      : null;
  const now = new Date();

  const select = (id: string) => {
    router.replace(`/inbox?c=${id}`, { scroll: false });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Boîte de réception"
        description="Toutes vos demandes — Messenger, Gmail, WhatsApp, formulaire — traitées par votre agent IA."
        actions={
          <Button variant="outline" render={<Link href="/assistant" />}>
            <Plug className="size-4" aria-hidden />
            Canaux et réglages
          </Button>
        }
      />

      {data.items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Aucune conversation"
          description="Les demandes reçues sur vos canaux connectés apparaîtront ici, analysées par votre agent IA."
        />
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          {/* Colonne gauche : conversations */}
          <aside
            className={cn(
              PANEL_CLASS,
              "lg:row-span-2 xl:row-span-1 lg:max-h-[calc(100dvh-13rem)] lg:overflow-y-auto",
              selectedId && "hidden lg:block"
            )}
          >
            <ConversationList
              items={data.items}
              selectedId={selectedId}
              now={now}
              onSelect={select}
            />
          </aside>

          {/* Colonne centrale : fil */}
          <section
            className={cn(
              PANEL_CLASS,
              "flex min-h-[420px] flex-col lg:max-h-[calc(100dvh-13rem)]",
              !selectedId && "hidden lg:flex"
            )}
          >
            {selected && messages ? (
              <>
                <button
                  type="button"
                  onClick={() => router.replace("/inbox", { scroll: false })}
                  className="flex items-center gap-1.5 border-b border-border px-4 py-2 text-left text-xs text-muted-foreground lg:hidden"
                >
                  <ArrowLeft className="size-3.5" aria-hidden />
                  Toutes les conversations
                </button>
                <ConversationThread
                  conversation={selected}
                  messages={messages}
                  timezone={organization.timezone}
                />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
                Sélectionnez une conversation pour afficher le fil et
                l&apos;analyse de l&apos;agent.
              </div>
            )}
          </section>

          {/* Colonne droite : analyse de l'agent */}
          {selected && (
            <aside
              className={cn(
                PANEL_CLASS,
                "flex min-h-0 flex-col lg:max-h-[calc(100dvh-13rem)]",
                !selectedId && "hidden"
              )}
            >
              <AgentPanel
                key={selected.id}
                conversation={selected}
                analysis={analysis}
                organization={organization}
              />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
