// Quota IA mensuel par organisation — CÔTÉ SERVEUR UNIQUEMENT.
// Protège le crédit API de la plateforme : chaque organisation dispose d'un
// plafond mensuel de requêtes IA (assistant + agent d'onboarding). Les
// compteurs vivent dans ai_usage (migration 014), écrits via des fonctions
// gardées par le secret serveur ; les membres peuvent LIRE leur usage (RLS).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { rawRpc } from "@/lib/supabase/token-client";

const DEFAULT_MONTHLY_LIMIT = 300;

/** Plafond mensuel de requêtes IA par organisation (env AI_MONTHLY_LIMIT). */
export function aiMonthlyLimit(): number {
  const parsed = Number(process.env.AI_MONTHLY_LIMIT);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : DEFAULT_MONTHLY_LIMIT;
}

export const QUOTA_EXCEEDED_MESSAGE =
  "Le quota mensuel d'assistance IA de votre organisation est atteint — il se réinitialise au début du mois prochain.";

/**
 * Réserve une requête IA pour l'organisation. Sans secret serveur configuré
 * (environnements de développement), la garde est neutre. Une erreur
 * technique laisse passer (journalisée) : le quota protège le crédit, il ne
 * doit pas mettre l'assistant en panne.
 */
export async function consumeAiQuota(
  client: SupabaseClient<Database>,
  organizationId: string
): Promise<{ allowed: boolean; used?: number }> {
  const secret = process.env.WEBHOOK_INGEST_SECRET;
  if (!secret) return { allowed: true };
  const { data, error } = await rawRpc<number>(client, "consume_ai_quota", {
    p_secret: secret,
    p_organization_id: organizationId,
    p_limit: aiMonthlyLimit(),
  });
  if (error) {
    console.error("[ai-quota] consume error:", error.message);
    return { allowed: true };
  }
  return typeof data === "number" && data >= 0
    ? { allowed: true, used: data }
    : { allowed: false };
}

/** Ajoute les tokens réellement consommés (jamais bloquant). */
export async function recordAiTokens(
  client: SupabaseClient<Database>,
  organizationId: string,
  usage: { inputTokens?: number; outputTokens?: number } | undefined
): Promise<void> {
  const secret = process.env.WEBHOOK_INGEST_SECRET;
  if (!secret || !usage) return;
  const { error } = await rawRpc(client, "record_ai_tokens", {
    p_secret: secret,
    p_organization_id: organizationId,
    p_input_tokens: Math.round(usage.inputTokens ?? 0),
    p_output_tokens: Math.round(usage.outputTokens ?? 0),
  });
  if (error) console.error("[ai-quota] tokens error:", error.message);
}
