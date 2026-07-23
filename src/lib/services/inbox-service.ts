// Service Boîte de réception / Agent IA — toutes les écritures passent
// ici : envoi de réponses, formulaire, transfert, connexions de canaux,
// réglages de l'agent. Le repository sous-jacent (mock aujourd'hui,
// Supabase + APIs des canaux demain) ne fait que persister.

import { z } from "zod";
import { getDataProvider } from "@/lib/data";
import type { DataProvider } from "@/lib/data/repositories";
import type { ChannelKind, InboxConversation } from "@/lib/types/inbox";
import {
  actionError,
  actionOk,
  zodError,
  type ActionResult,
} from "@/server/action-result";

const channelSchema = z.enum([
  "messenger",
  "gmail",
  "outlook",
  "whatsapp",
  "form",
]);

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
  notify_new_messages: z.boolean().optional(),
  notify_email: z
    .string()
    .trim()
    .email("Adresse email invalide")
    .max(200)
    .nullable()
    .optional(),
  activated_at: z.string().nullable().optional(),
});

/**
 * La réponse sur cette conversation sera-t-elle réellement délivrée au
 * client ? Vrai en mode Supabase pour un fil Messenger (psid) ou e-mail
 * (Gmail/Outlook) réel — faux pour les canaux simulés et le mode mock.
 */
export function deliversForReal(
  conversation: Pick<InboxConversation, "channel" | "customer_contact">,
  provider: DataProvider = getDataProvider()
): boolean {
  if (provider.kind !== "supabase") return false;
  return (
    (conversation.channel === "messenger" &&
      Boolean(conversation.customer_contact?.startsWith("psid:"))) ||
    ((conversation.channel === "gmail" || conversation.channel === "outlook") &&
      Boolean(conversation.customer_contact?.startsWith("email:")))
  );
}

/**
 * Envoi d'une réponse sur le canal de la conversation.
 * En mode réel, Messenger et les fils e-mail (Gmail/Outlook) partent
 * effectivement via les routes serveur (jetons côté serveur, trace ajoutée
 * au fil). Autres cas : envoi simulé (message ajouté au fil uniquement).
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

  const realSendRoute =
    conversation.channel === "messenger" &&
    conversation.customer_contact?.startsWith("psid:")
      ? "/api/channels/messenger/send"
      : (conversation.channel === "gmail" ||
            conversation.channel === "outlook") &&
          conversation.customer_contact?.startsWith("email:")
        ? "/api/channels/email/send"
        : null;

  if (provider.kind === "supabase" && realSendRoute && provider.getAccessToken) {
    const token = await provider.getAccessToken();
    if (token) {
      const response = await fetch(realSendRoute, {
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
        return actionError(data.error ?? "Envoi impossible");
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

/** Suppression définitive (conversation + messages). */
export async function deleteConversation(
  conversationId: string,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const conversation = await provider.inbox.getConversation(conversationId);
  if (!conversation) return actionError("Conversation introuvable");
  try {
    await provider.inbox.deleteConversation(conversationId);
  } catch (error) {
    return actionError(
      error instanceof Error ? error.message : "Suppression impossible"
    );
  }
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
