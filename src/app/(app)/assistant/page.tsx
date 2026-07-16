import { requireOrgContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { resolveProvider } from "@/lib/ai/provider";
import { PageHeader } from "@/components/shared/page-header";
import { AssistantChat, type ChatMessage } from "@/components/assistant/chat";
import { proposalSchema, type AssistantProposal } from "@/lib/ai/proposals";
import { z } from "zod";

export const metadata = { title: "Assistant IA" };

export default async function AssistantPage() {
  const context = await requireOrgContext();
  const supabase = await createClient();
  const provider = resolveProvider();

  // Reprend la conversation la plus récente de l'utilisateur.
  const { data: conversation } = await supabase
    .from("assistant_conversations")
    .select("id")
    .eq("organization_id", context.organization.id)
    .eq("user_id", context.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let initialMessages: ChatMessage[] = [];
  if (conversation) {
    const { data: rows } = await supabase
      .from("assistant_messages")
      .select("role, content, tool_calls")
      .eq("conversation_id", conversation.id)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true })
      .limit(60);

    initialMessages = (rows ?? []).map((m) => {
      let proposals: AssistantProposal[] = [];
      if (m.tool_calls) {
        const parsed = z.array(proposalSchema).safeParse(m.tool_calls);
        if (parsed.success) proposals = parsed.data;
      }
      return {
        role: m.role as "user" | "assistant",
        content: m.content,
        // Les propositions historiques ne sont plus confirmables : elles
        // datent d'un contexte qui a pu changer.
        proposals,
        stale: true,
      };
    });
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <PageHeader
        title="Assistant IA"
        description={
          provider.mode === "demo"
            ? "Mode démonstration : réponses déterministes basées sur vos données (aucune clé IA configurée)."
            : "Posez vos questions sur votre activité : disponibilités, réservations, clients, statistiques."
        }
      />
      <AssistantChat
        conversationId={conversation?.id ?? null}
        initialMessages={initialMessages}
        currency={context.organization.currency}
        demoMode={provider.mode === "demo"}
      />
    </div>
  );
}
