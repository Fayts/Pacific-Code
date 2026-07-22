// Envoi RÉEL d'une réponse e-mail (Gmail ou Outlook) depuis la boîte de
// réception. L'utilisateur est authentifié par son jeton Supabase ; les
// jetons du compte e-mail sont récupérés côté serveur (fonctions gardées
// par secret) — ils ne quittent jamais le serveur. La réponse part dans le
// fil d'origine (threading), puis est tracée dans la conversation.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  emailIngestSecret,
  emailProviderConfigured,
  ensureFreshTokens,
  sendGmailReply,
  sendOutlookReply,
  type EmailProvider,
} from "@/lib/email/server";
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
  body: z.string().trim().min(1).max(4000),
  auto: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
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
  if (conv.channel !== "gmail" && conv.channel !== "outlook") {
    return NextResponse.json(
      { error: "Cette conversation n'est pas un fil e-mail réel." },
      { status: 400 }
    );
  }
  const provider = conv.channel as EmailProvider;
  if (!emailProviderConfigured(provider)) {
    return NextResponse.json(
      { error: "Ce canal e-mail n'est pas configuré sur ce serveur." },
      { status: 501 }
    );
  }

  const secret = emailIngestSecret();
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
    p_conversation_id: conv.id,
  });
  const thread = Array.isArray(threadRows) ? threadRows[0] : undefined;
  if (!thread) {
    return NextResponse.json(
      { error: "Fil e-mail introuvable pour cette conversation." },
      { status: 400 }
    );
  }

  const { data: accountRows } = await rawRpc<
    Array<{
      address: string;
      refresh_token: string;
      access_token: string;
      token_expires_at: string;
    }>
  >(supabase, "get_email_account_for_org", {
    p_secret: secret,
    p_organization_id: conv.organization_id,
    p_provider: provider,
  });
  const account = Array.isArray(accountRows) ? accountRows[0] : undefined;
  if (!account) {
    return NextResponse.json(
      { error: "Aucun compte e-mail connecté pour cette organisation." },
      { status: 400 }
    );
  }

  try {
    const { tokens, refreshed } = await ensureFreshTokens(provider, {
      accessToken: account.access_token,
      refreshToken: account.refresh_token,
      expiresAt: account.token_expires_at,
    });
    if (refreshed) {
      await rawRpc(supabase, "update_email_account_tokens", {
        p_secret: secret,
        p_organization_id: conv.organization_id,
        p_provider: provider,
        p_access_token: tokens.accessToken,
        p_expires_at: tokens.expiresAt,
        p_refresh_token: tokens.refreshToken,
        p_cursor: null,
      });
    }

    if (provider === "gmail") {
      await sendGmailReply(tokens.accessToken, {
        to: thread.from_email,
        subject: thread.subject ?? "",
        body: parsed.data.body,
        threadId: thread.thread_id,
        inReplyTo: thread.reply_to_message_id ?? undefined,
      });
    } else {
      if (!thread.reply_to_message_id) {
        throw new Error("Message d'origine introuvable pour la réponse.");
      }
      await sendOutlookReply(tokens.accessToken, {
        messageId: thread.reply_to_message_id,
        body: parsed.data.body,
      });
    }
  } catch (err) {
    console.error("email send error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error && err.message
            ? `Envoi e-mail refusé : ${err.message}`
            : "Envoi e-mail impossible — réessayez.",
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
