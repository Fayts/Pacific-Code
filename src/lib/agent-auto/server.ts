// Réponse automatique de l'agent commercial — CÔTÉ SERVEUR (Lot 19).
// Appelée à l'ingestion d'un message (webhook Messenger, relève email) :
// si le mode automatique est activé, Claude lit la conversation et le
// catalogue réel, vérifie la disponibilité via un outil borné, et répond
// aux demandes SIMPLES (tarif, dispo, infos pratiques, question de
// clarification). Tout le reste → « ESCALADE » : rien n'est envoyé, le
// loueur est notifié comme d'habitude. Jamais bloquant pour l'ingestion.

import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { rawRpc } from "@/lib/supabase/token-client";
import { resolveProvider } from "@/lib/ai/provider";
import { consumeAiQuota, recordAiTokens } from "@/lib/ai/quota";
import { parseLocalDateTimeInput } from "@/lib/core/dates";
import { sendMessengerText } from "@/lib/messenger/server";
import {
  ensureFreshTokens,
  sendGmailReply,
  sendOutlookReply,
  type EmailProvider,
} from "@/lib/email/server";

type AutoContext = {
  eligible: boolean;
  reason?: string;
  organization_id?: string;
  channel?: string;
  customer_name?: string;
  customer_contact?: string;
  subject?: string | null;
  organization?: {
    name: string;
    currency: string;
    timezone: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  settings?: { tone: string; signature: string; practical_info: string };
  equipment?: Array<Record<string, unknown>>;
  messages?: Array<{
    direction: "inbound" | "outbound";
    author: string;
    body: string;
  }>;
};

export type AutoReplyResult = { replied: boolean; replyText?: string };

const TONE_HINTS: Record<string, string> = {
  professional: "professionnel et courtois",
  warm: "chaleureux et accueillant",
  concise: "concis et direct",
  premium: "haut de gamme, attentionné",
};

function buildSystemPrompt(context: AutoContext): string {
  const org = context.organization!;
  const settings = context.settings!;
  const channel = context.channel === "messenger" ? "Messenger" : "email";
  return `Tu es l'agent commercial automatique de « ${org.name} » (location, Polynésie française). Tu réponds au client sur ${channel}, en français, avec vouvoiement, ton ${TONE_HINTS[settings.tone] ?? "professionnel"}.

CE QUE TU PEUX FAIRE (et rien d'autre) :
- répondre aux questions de TARIF à partir du catalogue ci-dessous — jamais de prix inventé ni négocié. pricing_mode "daily" = prix par jour (× durée) ; "flat" = forfait fixe. Monnaie : ${org.currency}, montants entiers.
- répondre aux questions sur le CONTENU ou les CARACTÉRISTIQUES d'un bien à partir de sa description dans le catalogue — cite fidèlement ce qui y figure (contenu d'un pack, accessoires inclus, usage) ; si un détail demandé n'y figure pas, dis que l'équipe le confirmera.
- le champ "addons" d'un bien liste ses accessoires payants en SUPPLÉMENT (non inclus) : mentionne-les avec leur prix quand le client s'intéresse à ce bien ou demande des extras.
- répondre aux questions de DISPONIBILITÉ en appelant l'outil checkAvailability (jamais de dispo affirmée sans l'outil).
- répondre aux questions PRATIQUES uniquement avec les informations pratiques ci-dessous — si l'information n'y figure pas, dis que l'équipe confirmera ce point.
- poser UNE question de CLARIFICATION si la demande est incomplète (matériel non précisé, dates absentes) — c'est la réponse la plus utile dans ce cas.

ESCALADE OBLIGATOIRE : si le message relève d'une réclamation, annulation, demande de remise, litige, paiement, sujet sensible, ou si tu n'es pas sûr de bien comprendre — réponds EXACTEMENT « ESCALADE » (un seul mot) et rien d'autre. Un humain prendra le relais.

FORME : message court (3 phrases maximum + question éventuelle), pas d'objet, pas de tournures robotiques. Termine par la signature : « ${settings.signature || org.name} ».

CATALOGUE (source de vérité) :
${JSON.stringify(context.equipment ?? [])}

INFORMATIONS PRATIQUES AUTORISÉES :
${settings.practical_info || "(aucune — ne promets ni horaires ni livraison)"}`;
}

/**
 * Tente une réponse automatique sur la conversation. Ne lève jamais :
 * en cas d'échec ou d'inéligibilité, l'ingestion et la notification
 * continuent normalement.
 */
export async function runAutoReply(params: {
  supabase: SupabaseClient<Database>;
  secret: string;
  conversationId: string;
}): Promise<AutoReplyResult> {
  const { supabase, secret, conversationId } = params;
  try {
    const provider = resolveProvider();
    if (provider.mode !== "llm") return { replied: false };

    const { data: rawContext } = await rawRpc<AutoContext>(
      supabase,
      "agent_auto_context",
      { p_secret: secret, p_conversation_id: conversationId }
    );
    const context = rawContext as AutoContext | null;
    if (!context?.eligible) {
      if (context?.reason && context.reason !== "mode assisté") {
        console.log(`[agent-auto] inéligible : ${context.reason}`);
      }
      return { replied: false };
    }
    const orgId = context.organization_id!;
    const timezone = context.organization?.timezone ?? "Pacific/Tahiti";

    const quota = await consumeAiQuota(supabase, orgId);
    if (!quota.allowed) {
      console.log("[agent-auto] quota IA atteint — pas de réponse auto");
      return { replied: false };
    }

    const checkAvailability = tool({
      description:
        "Vérifie la disponibilité réelle d'un matériel du catalogue sur une période (heure locale de l'entreprise).",
      inputSchema: z.object({
        equipmentId: z.string().uuid(),
        startAt: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "format yyyy-MM-ddTHH:mm"),
        endAt: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "format yyyy-MM-ddTHH:mm"),
        quantity: z.number().int().min(1).max(100).default(1),
      }),
      execute: async (input) => {
        try {
          const start = parseLocalDateTimeInput(input.startAt, timezone);
          const end = parseLocalDateTimeInput(input.endAt, timezone);
          const { data } = await rawRpc(
            supabase,
            "check_equipment_availability_secret",
            {
              p_secret: secret,
              p_organization_id: orgId,
              p_equipment_id: input.equipmentId,
              p_start_at: start.toISOString(),
              p_end_at: end.toISOString(),
              p_quantity: input.quantity,
            }
          );
          return data ?? { available: false, reason: "erreur" };
        } catch (error) {
          return {
            available: false,
            reason:
              error instanceof Error ? error.message : "période invalide",
          };
        }
      },
    });

    const history = (context.messages ?? []).map((message) => ({
      role:
        message.direction === "inbound"
          ? ("user" as const)
          : ("assistant" as const),
      content: message.body,
    }));
    if (history.length === 0 || history[history.length - 1].role !== "user") {
      return { replied: false };
    }

    const result = await generateText({
      model: provider.model,
      system: buildSystemPrompt(context),
      messages: history,
      tools: { checkAvailability },
      stopWhen: stepCountIs(4),
      abortSignal: AbortSignal.timeout(30_000),
    });
    await recordAiTokens(supabase, orgId, result.usage);

    const reply = result.text.trim();
    if (!reply || /^escalade\b/i.test(reply)) {
      console.log("[agent-auto] escalade — réponse laissée au loueur");
      return { replied: false };
    }

    // ---- Envoi sur le canal d'origine --------------------------------
    if (context.channel === "messenger") {
      const psid = context.customer_contact?.startsWith("psid:")
        ? context.customer_contact.slice("psid:".length)
        : null;
      if (!psid) return { replied: false };
      const { data: pageRows } = await rawRpc<
        Array<{ page_id: string; access_token: string }>
      >(supabase, "get_messenger_page_for_org", {
        p_secret: secret,
        p_organization_id: orgId,
      });
      const page = Array.isArray(pageRows) ? pageRows[0] : undefined;
      if (!page) return { replied: false };
      await sendMessengerText(page.access_token, psid, reply);
    } else {
      const emailProvider = context.channel as EmailProvider;
      const { data: threadRows } = await rawRpc<
        Array<{
          provider: string;
          thread_id: string;
          subject: string | null;
          reply_to_message_id: string | null;
          from_email: string;
        }>
      >(supabase, "get_email_thread", {
        p_secret: secret,
        p_conversation_id: conversationId,
      });
      const thread = Array.isArray(threadRows) ? threadRows[0] : undefined;
      if (!thread) return { replied: false };
      const { data: accountRows } = await rawRpc<
        Array<{
          address: string;
          refresh_token: string;
          access_token: string;
          token_expires_at: string;
        }>
      >(supabase, "get_email_account_for_org", {
        p_secret: secret,
        p_organization_id: orgId,
        p_provider: emailProvider,
      });
      const account = Array.isArray(accountRows) ? accountRows[0] : undefined;
      if (!account) return { replied: false };
      const { tokens, refreshed } = await ensureFreshTokens(emailProvider, {
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
        expiresAt: account.token_expires_at,
      });
      if (refreshed) {
        await rawRpc(supabase, "update_email_account_tokens", {
          p_secret: secret,
          p_organization_id: orgId,
          p_provider: emailProvider,
          p_access_token: tokens.accessToken,
          p_expires_at: tokens.expiresAt,
          p_refresh_token: tokens.refreshToken,
          p_cursor: null,
        });
      }
      if (emailProvider === "gmail") {
        await sendGmailReply(tokens.accessToken, {
          to: thread.from_email,
          subject: thread.subject ?? context.subject ?? "votre demande",
          body: reply,
          threadId: thread.thread_id,
          inReplyTo: thread.reply_to_message_id ?? undefined,
        });
      } else {
        if (!thread.reply_to_message_id) return { replied: false };
        await sendOutlookReply(tokens.accessToken, {
          messageId: thread.reply_to_message_id,
          body: reply,
        });
      }
    }

    await rawRpc(supabase, "record_agent_reply", {
      p_secret: secret,
      p_conversation_id: conversationId,
      p_body: reply,
    });
    console.log(`[agent-auto] réponse envoyée (${context.channel})`);
    return { replied: true, replyText: reply };
  } catch (error) {
    console.error(
      "[agent-auto] échec :",
      error instanceof Error ? error.message : error
    );
    return { replied: false };
  }
}
