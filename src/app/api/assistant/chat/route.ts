import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText, isStepCount, type ModelMessage } from "ai";
import { getOrgContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createAssistantToolkit, extractProposals } from "@/lib/ai/tools";
import { resolveProvider } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { runDemoAssistant } from "@/lib/ai/demo";
import { logActivity } from "@/server/activity";
import type { AssistantProposal, AssistantChatResponse } from "@/lib/ai/proposals";

const bodySchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1, "Message vide").max(4000),
});

export async function POST(request: Request) {
  const context = await getOrgContext();
  if (!context) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Message invalide" }, { status: 400 });
  }

  const supabase = await createClient();
  const orgId = context.organization.id;

  // Conversation : réutilise celle fournie (si elle appartient bien à
  // l'utilisateur — RLS le garantit aussi), sinon en crée une nouvelle.
  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const { data: existing } = await supabase
      .from("assistant_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("organization_id", orgId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!existing) conversationId = null;
  }
  if (!conversationId) {
    const { data: created, error } = await supabase
      .from("assistant_conversations")
      .insert({
        organization_id: orgId,
        user_id: context.userId,
        title: parsed.data.message.slice(0, 80),
      })
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json(
        { error: "Création de la conversation impossible" },
        { status: 500 }
      );
    }
    conversationId = created.id;
  }

  await supabase.from("assistant_messages").insert({
    organization_id: orgId,
    conversation_id: conversationId,
    role: "user",
    content: parsed.data.message,
  });

  const toolkit = await createAssistantToolkit(context);
  const provider = resolveProvider();

  let text = "";
  let proposals: AssistantProposal[] = [];

  try {
    if (provider.mode === "demo") {
      const result = await runDemoAssistant(context, toolkit, parsed.data.message);
      text = result.text;
      proposals = result.proposals;
    } else {
      // Historique court pour garder le contexte de la conversation.
      const { data: historyRows } = await supabase
        .from("assistant_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .in("role", ["user", "assistant"])
        .order("created_at", { ascending: false })
        .limit(12);

      const history: ModelMessage[] = (historyRows ?? [])
        .reverse()
        .filter((m) => m.content.trim().length > 0)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const result = await generateText({
        model: provider.model,
        system: buildSystemPrompt(context),
        messages: history.length > 0
          ? history
          : [{ role: "user", content: parsed.data.message }],
        tools: toolkit.aiTools,
        stopWhen: isStepCount(8),
      });

      text = result.text.trim() || "Je n'ai pas de réponse à afficher.";
      const allToolOutputs = result.steps.flatMap((step) =>
        step.toolResults.map(
          (r) => (r as { output?: unknown }).output ?? null
        )
      );
      proposals = extractProposals(allToolOutputs);
    }
  } catch (err) {
    console.error("assistant error:", err);
    return NextResponse.json(
      {
        error:
          "L'assistant n'a pas pu répondre. Vérifiez la configuration du fournisseur IA ou réessayez.",
      },
      { status: 502 }
    );
  }

  await supabase.from("assistant_messages").insert({
    organization_id: orgId,
    conversation_id: conversationId,
    role: "assistant",
    content: text,
    tool_calls: proposals.length > 0 ? JSON.parse(JSON.stringify(proposals)) : null,
  });

  await logActivity(supabase, {
    organizationId: orgId,
    userId: context.userId,
    action: "assistant.message",
    entityType: "assistant_conversation",
    entityId: conversationId ?? undefined,
    metadata: { mode: provider.mode, proposals: proposals.length },
  });

  const response: AssistantChatResponse = {
    conversationId: conversationId!,
    text,
    proposals,
  };
  return NextResponse.json(response);
}
