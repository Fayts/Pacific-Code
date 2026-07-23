// Assistant IA en mode LLM réel : un tour de conversation par requête,
// sans état côté serveur (l'historique court voyage avec la requête).
//
// - La clé du fournisseur IA reste côté serveur (jamais dans le navigateur).
// - L'utilisateur est authentifié par son jeton Supabase (Bearer) : le
//   client injecté dans les outils respecte la RLS — l'IA ne voit QUE les
//   données de son organisation, et ne modifie JAMAIS rien (propositions
//   confirmées par l'utilisateur, exécutées par les services standard).
// - Sans clé configurée : {"mode":"demo"} → le client bascule sur le
//   moteur déterministe local.

import { NextResponse, type NextRequest } from "next/server";
import { generateText, stepCountIs } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { resolveProvider } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createAssistantToolkit, extractProposals } from "@/lib/ai/tools";
import {
  consumeAiQuota,
  QUOTA_EXCEEDED_MESSAGE,
  recordAiTokens,
} from "@/lib/ai/quota";
import { checkRateLimit, clientAddress } from "@/lib/core/rate-limit";
import type { AssistantProposal } from "@/lib/ai/proposals";

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 5 * 60_000;

const requestSchema = z.object({
  message: z.string().trim().min(1, "Message vide").max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      })
    )
    .max(12)
    .default([]),
});

export async function POST(request: NextRequest) {
  const provider = resolveProvider();
  if (provider.mode === "demo") {
    // Pas de clé IA : le client utilise le moteur déterministe local.
    return NextResponse.json({ mode: "demo" });
  }

  const limited = checkRateLimit(
    `assistant-chat:${clientAddress(request.headers)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS
  );
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      }
    );
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Message invalide" }, { status: 400 });
  }

  // Client Supabase au nom de l'utilisateur : la RLS s'applique.
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  const { data: userData } = await supabase.auth.getUser(token);
  if (!userData.user) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();
  if (!member) {
    return NextResponse.json(
      { error: "Aucune organisation active" },
      { status: 403 }
    );
  }
  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name, timezone, currency")
    .eq("id", member.organization_id)
    .single();
  if (!organization) {
    return NextResponse.json(
      { error: "Organisation introuvable" },
      { status: 403 }
    );
  }

  // Quota IA mensuel de l'organisation (protège le crédit de la plateforme).
  const quota = await consumeAiQuota(supabase, organization.id);
  if (!quota.allowed) {
    return NextResponse.json({ error: QUOTA_EXCEEDED_MESSAGE }, { status: 429 });
  }

  const toolkit = await createAssistantToolkit(supabase, {
    organizationId: organization.id,
    timezone: organization.timezone,
    currency: organization.currency,
  });

  try {
    const result = await generateText({
      model: provider.model,
      system: buildSystemPrompt({ organization }),
      messages: [
        ...parsed.data.history.filter((m) => m.content.trim().length > 0),
        { role: "user" as const, content: parsed.data.message },
      ],
      tools: toolkit.aiTools,
      stopWhen: stepCountIs(8),
    });

    await recordAiTokens(supabase, organization.id, result.usage);

    const toolOutputs = result.steps.flatMap((step) =>
      step.toolResults.map((r) => (r as { output?: unknown }).output ?? null)
    );
    const proposals: AssistantProposal[] = extractProposals(toolOutputs);

    return NextResponse.json({
      mode: "llm",
      text: result.text.trim() || "Je n'ai pas de réponse à afficher.",
      proposals,
    });
  } catch (err) {
    console.error("assistant chat error:", err);
    return NextResponse.json(
      { error: "L'assistant n'a pas pu répondre — réessayez dans un instant." },
      { status: 502 }
    );
  }
}
