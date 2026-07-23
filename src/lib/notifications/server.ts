// Notification du loueur à l'arrivée d'un message client — CÔTÉ SERVEUR.
// Appelée après chaque ingestion (webhook Messenger, relève email).
// Transport : le compte email connecté du loueur envoie l'alerte à
// lui-même (ou à l'adresse choisie dans les réglages) — aucun service
// d'envoi tiers. Anti-rafale : claim_inbound_notification n'accorde le
// droit de notifier qu'une fois par conversation par fenêtre de 30 min
// (réservation atomique côté SQL). Une notification qui échoue ne doit
// JAMAIS faire échouer l'ingestion : tout est attrapé et journalisé.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { rawRpc } from "@/lib/supabase/token-client";
import {
  ensureFreshTokens,
  sendGmailNewMessage,
  sendOutlookNewMessage,
  type EmailProvider,
} from "@/lib/email/server";

const COOLDOWN_MINUTES = 30;

const CHANNEL_LABELS: Record<string, string> = {
  messenger: "Messenger",
  gmail: "Email",
  outlook: "Email",
  whatsapp: "WhatsApp",
  form: "Formulaire",
};

function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://pacific-code.duckdns.org"
  );
}

type ClaimRow = {
  organization_id: string;
  notify_email: string | null;
  customer_name: string;
  channel: string;
  subject: string | null;
};

type AccountRow = {
  address: string;
  refresh_token: string;
  access_token: string;
  token_expires_at: string;
};

/**
 * Notifie le loueur d'un message entrant (si la fenêtre anti-rafale
 * l'autorise et qu'un compte email est connecté). Jamais bloquant.
 */
export async function notifyInboundMessage(params: {
  supabase: SupabaseClient<Database>;
  secret: string;
  conversationId: string;
  /** Extrait du message reçu, affiché dans l'alerte. */
  snippet: string;
}): Promise<void> {
  try {
    const { supabase, secret, conversationId } = params;

    const { data: claimRows } = await rawRpc<ClaimRow[]>(
      supabase,
      "claim_inbound_notification",
      {
        p_secret: secret,
        p_conversation_id: conversationId,
        p_cooldown_minutes: COOLDOWN_MINUTES,
      }
    );
    const claim = Array.isArray(claimRows) ? claimRows[0] : undefined;
    if (!claim) return; // désactivé, fenêtre anti-rafale, ou conversation inconnue

    // Transport : premier compte email connecté de l'organisation.
    let provider: EmailProvider | null = null;
    let account: AccountRow | null = null;
    for (const candidate of ["gmail", "outlook"] as const) {
      const { data: accountRows } = await rawRpc<AccountRow[]>(
        supabase,
        "get_email_account_for_org",
        {
          p_secret: secret,
          p_organization_id: claim.organization_id,
          p_provider: candidate,
        }
      );
      const row = Array.isArray(accountRows) ? accountRows[0] : undefined;
      if (row) {
        provider = candidate;
        account = row;
        break;
      }
    }
    if (!provider || !account) {
      console.log(
        "[notify] pas de compte email connecté — notification ignorée"
      );
      return;
    }

    const { tokens, refreshed } = await ensureFreshTokens(provider, {
      accessToken: account.access_token,
      refreshToken: account.refresh_token,
      expiresAt: account.token_expires_at,
    });
    if (refreshed) {
      await rawRpc(supabase, "update_email_account_tokens", {
        p_secret: secret,
        p_organization_id: claim.organization_id,
        p_provider: provider,
        p_access_token: tokens.accessToken,
        p_expires_at: tokens.expiresAt,
        p_refresh_token: tokens.refreshToken,
        p_cursor: null,
      });
    }

    const to = claim.notify_email ?? account.address;
    // Un email reçu dans cette boîte n'a pas besoin d'une alerte… dans la
    // même boîte. (L'alerte reste utile si l'adresse de notification diffère.)
    if (
      (claim.channel === "gmail" || claim.channel === "outlook") &&
      to.toLowerCase() === account.address.toLowerCase()
    ) {
      return;
    }
    const channelLabel = CHANNEL_LABELS[claim.channel] ?? claim.channel;
    const subject = `${claim.customer_name} vous a écrit (${channelLabel}) — Pacific Code`;
    const snippet = params.snippet.replace(/\s+/g, " ").trim().slice(0, 300);
    const body = [
      `Nouveau message reçu sur ${channelLabel}.`,
      "",
      `De : ${claim.customer_name}`,
      ...(claim.subject ? [`Objet : ${claim.subject}`] : []),
      `Message : ${snippet}${params.snippet.length > 300 ? "…" : ""}`,
      "",
      `Répondre : ${appBaseUrl()}/inbox?c=${conversationId}`,
      "",
      "— Pacific Code (notification automatique ; réglable dans Assistant → Connexions)",
    ].join("\n");

    if (provider === "gmail") {
      await sendGmailNewMessage(tokens.accessToken, { to, subject, body });
    } else {
      await sendOutlookNewMessage(tokens.accessToken, { to, subject, body });
    }
    console.log(`[notify] alerte envoyée (${claim.channel} → ${provider})`);
  } catch (error) {
    console.error(
      "[notify] échec de notification :",
      error instanceof Error ? error.message : error
    );
  }
}
