// Relève des boîtes e-mail connectées (Gmail + Outlook) : appelée par une
// tâche cron du serveur toutes les 2 minutes avec le secret d'ingestion.
// Pour chaque compte : jeton rafraîchi si besoin, nouveaux messages relevés
// depuis le point de reprise, ingérés dans la boîte de réception, point de
// reprise avancé. Un échec sur un compte n'empêche pas les autres.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  emailIngestSecret,
  ensureFreshTokens,
  listNewGmailMessages,
  listNewOutlookMessages,
  type EmailProvider,
  type IncomingEmail,
} from "@/lib/email/server";
import { createAnonClient, rawRpc } from "@/lib/supabase/token-client";

export const runtime = "nodejs";
export const maxDuration = 60;

type StoredAccount = {
  organization_id: string;
  provider: EmailProvider;
  address: string;
  refresh_token: string;
  access_token: string;
  token_expires_at: string;
  cursor: string;
};

function secretMatches(header: string | null): boolean {
  if (!header) return false;
  try {
    const a = Buffer.from(header);
    const b = Buffer.from(emailIngestSecret());
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Point de reprise suivant : gmail = seconde du dernier message + 1. */
function nextCursor(provider: EmailProvider, last: IncomingEmail): string {
  if (provider === "gmail") {
    const epochMs = Number(last.position);
    return Number.isFinite(epochMs) && epochMs > 0
      ? String(Math.floor(epochMs / 1000) + 1)
      : String(Math.floor(Date.now() / 1000));
  }
  return last.position || new Date().toISOString();
}

export async function POST(request: NextRequest) {
  if (!process.env.WEBHOOK_INGEST_SECRET) {
    return NextResponse.json({ error: "Non configuré" }, { status: 501 });
  }
  if (!secretMatches(request.headers.get("x-ingest-secret"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = createAnonClient();
  const secret = emailIngestSecret();

  const { data: accountRows, error: listError } = await rawRpc<StoredAccount[]>(
    supabase,
    "list_email_accounts",
    { p_secret: secret }
  );
  if (listError) {
    console.error("[email/poll] list error:", listError.message);
    return NextResponse.json({ error: "Relève impossible" }, { status: 500 });
  }

  const summary: Array<{ provider: string; ingested: number; error?: string }> =
    [];

  for (const account of accountRows ?? []) {
    try {
      const { tokens, refreshed } = await ensureFreshTokens(account.provider, {
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
        expiresAt: account.token_expires_at,
      });

      const messages =
        account.provider === "gmail"
          ? await listNewGmailMessages(
              tokens.accessToken,
              account.address,
              account.cursor
            )
          : await listNewOutlookMessages(
              tokens.accessToken,
              account.address,
              account.cursor
            );

      let ingested = 0;
      for (const message of messages) {
        const { error: ingestError } = await rawRpc(
          supabase,
          "ingest_email_message",
          {
            p_secret: secret,
            p_organization_id: account.organization_id,
            p_provider: account.provider,
            p_thread_id: message.threadId,
            p_from_name: message.fromName,
            p_from_email: message.fromEmail,
            p_subject: message.subject,
            p_body: message.body,
            p_reply_to_message_id: message.replyToMessageId,
          }
        );
        if (ingestError) {
          console.error("[email/poll] ingest error:", ingestError.message);
        } else {
          ingested += 1;
        }
      }

      // Avance le point de reprise et persiste les jetons rafraîchis.
      const last = messages[messages.length - 1];
      if (refreshed || last) {
        await rawRpc(supabase, "update_email_account_tokens", {
          p_secret: secret,
          p_organization_id: account.organization_id,
          p_provider: account.provider,
          p_access_token: refreshed ? tokens.accessToken : null,
          p_expires_at: refreshed ? tokens.expiresAt : null,
          p_refresh_token: refreshed ? tokens.refreshToken : null,
          p_cursor: last ? nextCursor(account.provider, last) : null,
        });
      }

      summary.push({ provider: account.provider, ingested });
    } catch (err) {
      // Journal technique sans contenu de message.
      console.error(
        `[email/poll] ${account.provider} error:`,
        err instanceof Error ? err.message : "erreur inconnue"
      );
      summary.push({
        provider: account.provider,
        ingested: 0,
        error: "relève échouée",
      });
    }
  }

  return NextResponse.json({ accounts: summary.length, summary });
}
