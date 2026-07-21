// Service Boîte de réception / Agent IA — toutes les écritures passent
// ici : envoi de réponses, formulaire, transfert, connexions de canaux,
// réglages de l'agent. Le repository sous-jacent (mock aujourd'hui,
// Supabase + APIs des canaux demain) ne fait que persister.

import { z } from "zod";
import { getDataProvider } from "@/lib/data";
import type { DataProvider } from "@/lib/data/repositories";
import type { ChannelKind } from "@/lib/types/inbox";
import {
  actionError,
  actionOk,
  zodError,
  type ActionResult,
} from "@/server/action-result";

const channelSchema = z.enum(["messenger", "gmail", "whatsapp", "form"]);

const replySchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1, "Réponse vide").max(4000),
  /** auto = envoyée par l'agent sans validation (mode automatique). */
  auto: z.boolean().default(false),
});

const simulateSchema = z.object({
  channel: channelSchema,
  customerName: z.string().trim().min(1, "Nom requis").max(120),
  customerContact: z.string().trim().max(200).optional().or(z.literal("")),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  body: z.string().trim().min(1, "Message vide").max(4000),
});

const settingsSchema = z.object({
  mode: z.enum(["assisted", "auto"]).optional(),
  tone: z.enum(["professional", "warm", "concise", "premium"]).optional(),
  signature: z.string().trim().max(200).optional(),
  practical_info: z.string().trim().max(2000).optional(),
  permissions: z
    .object({
      read_messages: z.boolean().optional(),
      detect_requests: z.boolean().optional(),
      check_availability: z.boolean().optional(),
      compute_prices: z.boolean().optional(),
      prepare_replies: z.boolean().optional(),
      auto_reply_simple: z.boolean().optional(),
      send_form: z.boolean().optional(),
    })
    .optional(),
  activated_at: z.string().nullable().optional(),
});

/**
 * Envoi d'une réponse sur le canal de la conversation.
 * Messenger en mode réel : envoi effectif via la route serveur (jeton de
 * Page côté serveur, trace ajoutée au fil). Autres cas : envoi simulé
 * (message ajouté au fil uniquement).
 */
export async function sendReply(
  input: z.infer<typeof replySchema>,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const conversation = await provider.inbox.getConversation(
    parsed.data.conversationId
  );
  if (!conversation) return actionError("Conversation introuvable");

  if (
    provider.kind === "supabase" &&
    conversation.channel === "messenger" &&
    conversation.customer_contact?.startsWith("psid:") &&
    provider.getAccessToken
  ) {
    const token = await provider.getAccessToken();
    if (token) {
      const response = await fetch("/api/channels/messenger/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(parsed.data),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        return actionError(data.error ?? "Envoi Messenger impossible");
      }
      // Les écritures ont eu lieu côté serveur : ce setStatus idempotent
      // déclenche simplement le rafraîchissement de l'interface.
      await provider.inbox.setStatus(
        parsed.data.conversationId,
        parsed.data.auto ? "auto_replied" : "replied"
      );
      return actionOk(undefined);
    }
  }

  const message = await provider.inbox.appendMessage(parsed.data.conversationId, {
    direction: "outbound",
    author: parsed.data.auto ? "agent" : "user",
    body: parsed.data.body,
  });
  if (!message) return actionError("Conversation introuvable");

  await provider.inbox.setStatus(
    parsed.data.conversationId,
    parsed.data.auto ? "auto_replied" : "replied"
  );
  return actionOk(undefined);
}

export async function transferConversation(
  conversationId: string,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const conversation = await provider.inbox.getConversation(conversationId);
  if (!conversation) return actionError("Conversation introuvable");
  await provider.inbox.setStatus(conversationId, "transferred");
  return actionOk(undefined);
}

export async function ignoreConversation(
  conversationId: string,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const conversation = await provider.inbox.getConversation(conversationId);
  if (!conversation) return actionError("Conversation introuvable");
  await provider.inbox.setStatus(conversationId, "ignored");
  return actionOk(undefined);
}

/** Nouvelle conversation entrante (simulation de test, formulaire public). */
export async function simulateIncomingMessage(
  input: z.infer<typeof simulateSchema>,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<{ conversationId: string }>> {
  const parsed = simulateSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const conversation = await provider.inbox.createConversation({
    channel: parsed.data.channel,
    customerName: parsed.data.customerName,
    customerContact: parsed.data.customerContact || undefined,
    subject: parsed.data.subject || undefined,
    body: parsed.data.body,
  });
  return actionOk({ conversationId: conversation.id });
}

/** Connexion simulée d'un canal (OAuth réel avec le backend). */
export async function connectChannel(
  channel: ChannelKind,
  displayName: string,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const parsedChannel = channelSchema.safeParse(channel);
  if (!parsedChannel.success) return actionError("Canal inconnu");
  const name = displayName.trim();
  if (!name) return actionError("Nom du compte requis");

  await provider.channels.connect(parsedChannel.data, name);
  return actionOk(undefined);
}

export async function disconnectChannel(
  channel: ChannelKind,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const parsedChannel = channelSchema.safeParse(channel);
  if (!parsedChannel.success) return actionError("Canal inconnu");

  await provider.channels.disconnect(parsedChannel.data);
  return actionOk(undefined);
}

export async function updateAgentSettings(
  input: z.infer<typeof settingsSchema>,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const current = await provider.agentSettings.get();
  await provider.agentSettings.update({
    ...parsed.data,
    permissions: parsed.data.permissions
      ? { ...current.permissions, ...parsed.data.permissions }
      : undefined,
  });
  return actionOk(undefined);
}
