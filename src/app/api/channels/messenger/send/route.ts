// Envoi RÉEL d'une réponse Messenger depuis la boîte de réception.
// L'utilisateur est authentifié par son jeton Supabase ; le jeton de Page
// est récupéré côté serveur (fonction gardée par secret) — il ne quitte
// jamais le serveur. Après envoi, le message est ajouté au fil et la
// conversation marquée répondue.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  messengerConfigured,
  sendMessengerText,
  webhookIngestSecret,
} from "@/lib/messenger/server";
import {
  bearerToken,
  createTokenClient,
  rawRpc,
  rawTable,
} from "@/lib/supabase/token-client";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
  auto: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  if (!messengerConfigured()) {
    return NextResponse.json(
      { error: "Canal Messenger non configuré sur ce serveur." },
      { status: 501 }
    );
  }

  const token = bearerToken(request);
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

  const supabase = createTokenClient(token);
  const { data: userData } = await supabase.auth.getUser(token);
  if (!userData.user) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }

  // Conversation lue SOUS RLS : seul un membre de l'organisation y accède.
  const { data: conversation } = await rawTable(supabase, "inbox_conversations")
    .select("id, organization_id, channel, customer_contact")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  const conv = conversation as {
    id: string;
    organization_id: string;
    channel: string;
    customer_contact: string | null;
  } | null;
  if (!conv) {
    return NextResponse.json(
      { error: "Conversation introuvable" },
      { status: 404 }
    );
  }
  if (conv.channel !== "messenger" || !conv.customer_contact?.startsWith("psid:")) {
    return NextResponse.json(
      { error: "Cette conversation n'est pas un fil Messenger réel." },
      { status: 400 }
    );
  }

  const { data: pageRows } = await rawRpc<
    Array<{ page_id: string; page_name: string; access_token: string }>
  >(supabase, "get_messenger_page_for_org", {
    p_secret: webhookIngestSecret(),
    p_organization_id: conv.organization_id,
  });
  const page = Array.isArray(pageRows) ? pageRows[0] : undefined;
  if (!page) {
    return NextResponse.json(
      { error: "Aucune Page Facebook connectée pour cette organisation." },
      { status: 400 }
    );
  }

  try {
    await sendMessengerText(
      page.access_token,
      conv.customer_contact.slice("psid:".length),
      parsed.data.body
    );
  } catch (err) {
    console.error("messenger send error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error && err.message
            ? `Envoi Messenger refusé : ${err.message}`
            : "Envoi Messenger impossible — réessayez.",
      },
      { status: 502 }
    );
  }

  // Trace dans la boîte de réception (écritures sous RLS).
  const nowIso = new Date().toISOString();
  await rawTable(supabase, "inbox_messages").insert({
    organization_id: conv.organization_id,
    conversation_id: conv.id,
    direction: "outbound",
    author: parsed.data.auto ? "agent" : "user",
    body: parsed.data.body,
  });
  await rawTable(supabase, "inbox_conversations")
    .update({
      status: parsed.data.auto ? "auto_replied" : "replied",
      last_message_at: nowIso,
    })
    .eq("id", conv.id);

  return NextResponse.json({ sent: true });
}
