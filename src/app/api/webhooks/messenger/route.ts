// Webhook Messenger : reçoit les messages envoyés à la Page Facebook du
// loueur et les fait entrer dans sa boîte de réception.
//
// Double authentification :
// 1. la signature X-Hub-Signature-256 (HMAC App Secret) prouve que la
//    requête vient bien de Meta ;
// 2. l'ingestion en base passe par une fonction SQL gardée par un secret
//    serveur (jamais exposé) — la clé anon seule ne permet rien.

import { NextResponse, type NextRequest } from "next/server";
import {
  fetchSenderName,
  messengerConfigured,
  metaVerifyToken,
  verifyMetaSignature,
  webhookIngestSecret,
} from "@/lib/messenger/server";
import { createAnonClient, rawRpc } from "@/lib/supabase/token-client";
import { notifyInboundMessage } from "@/lib/notifications/server";
import { runAutoReply } from "@/lib/agent-auto/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Vérification initiale du webhook par Meta (abonnement).
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === metaVerifyToken()
  ) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type MessagingEvent = {
  sender?: { id?: string };
  message?: { text?: string; is_echo?: boolean };
};

type WebhookEntry = {
  id?: string; // identifiant de la Page destinataire
  messaging?: MessagingEvent[];
};

export async function POST(request: NextRequest) {
  if (!messengerConfigured()) {
    return new Response("Not configured", { status: 501 });
  }

  const rawBody = await request.text();
  if (
    !verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))
  ) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: { object?: string; entry?: WebhookEntry[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }
  if (payload.object !== "page") {
    return NextResponse.json({ ignored: true });
  }

  const supabase = createAnonClient();
  const secret = webhookIngestSecret();

  for (const entry of payload.entry ?? []) {
    const pageId = entry.id;
    if (!pageId) continue;

    // Nom public de l'expéditeur (facultatif — jamais bloquant).
    let pageToken: string | null = null;
    const { data: pageRows } = await rawRpc<
      Array<{ organization_id: string; page_name: string; access_token: string }>
    >(supabase, "get_messenger_page_by_id", {
      p_secret: secret,
      p_page_id: pageId,
    });
    if (Array.isArray(pageRows) && pageRows.length > 0) {
      pageToken = pageRows[0].access_token;
    }

    for (const event of entry.messaging ?? []) {
      const psid = event.sender?.id;
      const message = event.message;
      if (!psid || !message || message.is_echo) continue;
      const text = message.text?.trim() || "[pièce jointe]";

      const senderName = pageToken
        ? await fetchSenderName(pageToken, psid)
        : "";

      const { data: conversationId, error } = await rawRpc(
        supabase,
        "ingest_messenger_message",
        {
          p_secret: secret,
          p_page_id: pageId,
          p_sender_psid: psid,
          p_sender_name: senderName,
          p_text: text,
        }
      );
      if (error) {
        console.error("messenger ingest error:", error.message);
      } else if (typeof conversationId === "string") {
        // Réponse automatique (mode auto uniquement), puis alerte email au
        // loueur — les deux sont bornés et jamais bloquants.
        const auto = await runAutoReply({ supabase, secret, conversationId });
        await notifyInboundMessage({
          supabase,
          secret,
          conversationId,
          snippet: text,
          autoReply: auto.replied ? (auto.replyText ?? null) : null,
        });
      }
    }
  }

  // Meta attend une réponse rapide en 200, quoi qu'il arrive.
  return NextResponse.json({ received: true });
}
