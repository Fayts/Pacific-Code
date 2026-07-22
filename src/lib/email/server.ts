// Intégration e-mail (Gmail + Outlook) — CÔTÉ SERVEUR UNIQUEMENT.
// Les secrets OAuth et les jetons de compte ne transitent jamais par le
// navigateur. Utilisé par les routes /api/channels/email/*.
//
// Réception par RELÈVE (polling) : une tâche cron appelle
// /api/channels/email/poll toutes les 2 minutes — pas de webhook à
// enregistrer chez Google/Microsoft, pas d'abonnement à renouveler.

import { createHmac, timingSafeEqual } from "node:crypto";

export type EmailProvider = "gmail" | "outlook";

export type EmailTokens = {
  accessToken: string;
  /** Nouveau refresh token si le fournisseur en a émis un (Microsoft). */
  refreshToken: string | null;
  expiresAt: string; // ISO
};

export type IncomingEmail = {
  threadId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  /** Gmail : Message-ID internet ; Outlook : identifiant Graph du message. */
  replyToMessageId: string;
  /** Position de relève : gmail = epoch ms ; outlook = ISO receivedDateTime. */
  position: string;
};

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const GOOGLE_SCOPES =
  "openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send";

const MS_AUTH = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH = "https://graph.microsoft.com/v1.0";
const MS_SCOPES = "offline_access User.Read Mail.Read Mail.Send";

// ------------------------------------------------------------
// Configuration
// ------------------------------------------------------------

function googleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID manquant");
  return id;
}

function googleClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET manquant");
  return secret;
}

function microsoftClientId(): string {
  const id = process.env.MICROSOFT_CLIENT_ID;
  if (!id) throw new Error("MICROSOFT_CLIENT_ID manquant");
  return id;
}

function microsoftClientSecret(): string {
  const secret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!secret) throw new Error("MICROSOFT_CLIENT_SECRET manquant");
  return secret;
}

export function emailIngestSecret(): string {
  const secret = process.env.WEBHOOK_INGEST_SECRET;
  if (!secret) throw new Error("WEBHOOK_INGEST_SECRET manquant");
  return secret;
}

export function emailProviderConfigured(provider: EmailProvider): boolean {
  if (!process.env.WEBHOOK_INGEST_SECRET) return false;
  return provider === "gmail"
    ? Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    : Boolean(
        process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
      );
}

// ------------------------------------------------------------
// State OAuth signé (HMAC secret d'ingestion) : org + fournisseur + expiration.
// ------------------------------------------------------------

export function signEmailOauthState(
  orgId: string,
  provider: EmailProvider
): string {
  const payload = `${orgId}.${provider}.${Date.now() + 10 * 60_000}`;
  const signature = createHmac("sha256", emailIngestSecret())
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyEmailOauthState(
  state: string
): { orgId: string; provider: EmailProvider } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [orgId, provider, expiry, signature] = decoded.split(".");
    if (!orgId || !provider || !expiry || !signature) return null;
    if (provider !== "gmail" && provider !== "outlook") return null;
    if (Number(expiry) < Date.now()) return null;
    const expected = createHmac("sha256", emailIngestSecret())
      .update(`${orgId}.${provider}.${expiry}`)
      .digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { orgId, provider };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// URLs d'autorisation + échanges de jetons
// ------------------------------------------------------------

export function buildAuthUrl(
  provider: EmailProvider,
  redirectUri: string,
  state: string
): string {
  if (provider === "gmail") {
    const params = new URLSearchParams({
      client_id: googleClientId(),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPES,
      access_type: "offline",
      // consent force l'émission d'un refresh_token à chaque connexion.
      prompt: "consent",
      state,
    });
    return `${GOOGLE_AUTH}?${params.toString()}`;
  }
  const params = new URLSearchParams({
    client_id: microsoftClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: MS_SCOPES,
    state,
  });
  return `${MS_AUTH}?${params.toString()}`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function postForm(url: string, form: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const json = (await response.json()) as TokenResponse;
  if (!response.ok || !json.access_token) {
    throw new Error(
      json.error_description ?? json.error ?? `OAuth ${response.status}`
    );
  }
  return json;
}

function toTokens(json: TokenResponse): EmailTokens {
  return {
    accessToken: json.access_token!,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(
      Date.now() + Math.max(60, json.expires_in ?? 3600) * 1000
    ).toISOString(),
  };
}

export async function exchangeCode(
  provider: EmailProvider,
  code: string,
  redirectUri: string
): Promise<EmailTokens> {
  const form =
    provider === "gmail"
      ? new URLSearchParams({
          client_id: googleClientId(),
          client_secret: googleClientSecret(),
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        })
      : new URLSearchParams({
          client_id: microsoftClientId(),
          client_secret: microsoftClientSecret(),
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          scope: MS_SCOPES,
        });
  return toTokens(await postForm(provider === "gmail" ? GOOGLE_TOKEN : MS_TOKEN, form));
}

export async function refreshTokens(
  provider: EmailProvider,
  refreshToken: string
): Promise<EmailTokens> {
  const form =
    provider === "gmail"
      ? new URLSearchParams({
          client_id: googleClientId(),
          client_secret: googleClientSecret(),
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        })
      : new URLSearchParams({
          client_id: microsoftClientId(),
          client_secret: microsoftClientSecret(),
          refresh_token: refreshToken,
          grant_type: "refresh_token",
          scope: MS_SCOPES,
        });
  return toTokens(await postForm(provider === "gmail" ? GOOGLE_TOKEN : MS_TOKEN, form));
}

/** Jeton valide : rafraîchi si expiration dans moins de deux minutes. */
export async function ensureFreshTokens(
  provider: EmailProvider,
  account: { accessToken: string; refreshToken: string; expiresAt: string }
): Promise<{ tokens: EmailTokens; refreshed: boolean }> {
  if (new Date(account.expiresAt).getTime() - Date.now() > 2 * 60_000) {
    return {
      tokens: {
        accessToken: account.accessToken,
        refreshToken: null,
        expiresAt: account.expiresAt,
      },
      refreshed: false,
    };
  }
  return {
    tokens: await refreshTokens(provider, account.refreshToken),
    refreshed: true,
  };
}

// ------------------------------------------------------------
// Profil (adresse du compte connecté)
// ------------------------------------------------------------

export async function fetchAccountAddress(
  provider: EmailProvider,
  accessToken: string
): Promise<string> {
  if (provider === "gmail") {
    const profile = await apiGet<{ emailAddress?: string }>(
      `${GMAIL}/profile`,
      accessToken
    );
    if (!profile.emailAddress) throw new Error("Adresse Gmail introuvable");
    return profile.emailAddress;
  }
  const me = await apiGet<{ mail?: string; userPrincipalName?: string }>(
    `${GRAPH}/me`,
    accessToken
  );
  const address = me.mail ?? me.userPrincipalName;
  if (!address) throw new Error("Adresse Outlook introuvable");
  return address;
}

async function apiGet<T>(
  url: string,
  accessToken: string,
  headers?: Record<string, string>
): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, ...headers },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status} : ${text.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

// ------------------------------------------------------------
// Relève des nouveaux messages
// ------------------------------------------------------------

/** « Nom <adresse> » → { name, email }. */
export function parseFromHeader(value: string): { name: string; email: string } {
  const match = /^(.*?)<([^>]+)>\s*$/.exec(value.trim());
  if (match) {
    return {
      name: match[1].trim().replace(/^"|"$/g, ""),
      email: match[2].trim().toLowerCase(),
    };
  }
  return { name: "", email: value.trim().toLowerCase() };
}

/** Dégradation texte d'un corps HTML (relève et aperçus). */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type GmailPayload = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
};

/** Corps texte d'un message Gmail (text/plain prioritaire, sinon HTML). */
export function extractGmailBody(payload: GmailPayload | undefined): string {
  if (!payload) return "";
  const decode = (data?: string) =>
    data ? Buffer.from(data, "base64url").toString("utf8") : "";
  const findPart = (
    node: GmailPayload,
    mime: string
  ): GmailPayload | null => {
    if (node.mimeType === mime && node.body?.data) return node;
    for (const part of node.parts ?? []) {
      const found = findPart(part, mime);
      if (found) return found;
    }
    return null;
  };
  const plain = findPart(payload, "text/plain");
  if (plain) return decode(plain.body?.data).trim();
  const html = findPart(payload, "text/html");
  if (html) return htmlToText(decode(html.body?.data));
  return decode(payload.body?.data).trim();
}

type GmailMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: GmailPayload & {
    headers?: Array<{ name: string; value: string }>;
  };
};

function gmailHeader(message: GmailMessage, name: string): string {
  return (
    message.payload?.headers?.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    )?.value ?? ""
  );
}

/**
 * Nouveaux messages Gmail depuis le point de reprise (secondes epoch).
 * Les messages envoyés par le compte lui-même sont ignorés.
 */
export async function listNewGmailMessages(
  accessToken: string,
  ownAddress: string,
  cursorEpochSeconds: string
): Promise<IncomingEmail[]> {
  const query = encodeURIComponent(`in:inbox after:${cursorEpochSeconds}`);
  const list = await apiGet<{ messages?: Array<{ id: string }> }>(
    `${GMAIL}/messages?q=${query}&maxResults=20`,
    accessToken
  );
  const results: IncomingEmail[] = [];
  for (const ref of list.messages ?? []) {
    const message = await apiGet<GmailMessage>(
      `${GMAIL}/messages/${ref.id}?format=full`,
      accessToken
    );
    const from = parseFromHeader(gmailHeader(message, "From"));
    if (!from.email || from.email === ownAddress.toLowerCase()) continue;
    results.push({
      threadId: message.threadId,
      fromName: from.name,
      fromEmail: from.email,
      subject: gmailHeader(message, "Subject"),
      body: extractGmailBody(message.payload) || "[message vide]",
      replyToMessageId: gmailHeader(message, "Message-ID"),
      position: message.internalDate ?? "",
    });
  }
  // Ordre chronologique pour faire avancer le point de reprise proprement.
  results.sort((a, b) => Number(a.position) - Number(b.position));
  return results;
}

type GraphMessage = {
  id: string;
  conversationId?: string;
  subject?: string;
  receivedDateTime?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  body?: { contentType?: string; content?: string };
};

/** Nouveaux messages Outlook depuis le point de reprise (ISO). */
export async function listNewOutlookMessages(
  accessToken: string,
  ownAddress: string,
  cursorIso: string
): Promise<IncomingEmail[]> {
  const filter = encodeURIComponent(`receivedDateTime gt ${cursorIso}`);
  const select = "id,conversationId,subject,receivedDateTime,from,body";
  const list = await apiGet<{ value?: GraphMessage[] }>(
    `${GRAPH}/me/mailFolders/inbox/messages?$filter=${filter}&$orderby=receivedDateTime asc&$top=20&$select=${select}`,
    accessToken,
    { Prefer: 'outlook.body-content-type="text"' }
  );
  const results: IncomingEmail[] = [];
  for (const message of list.value ?? []) {
    const email = message.from?.emailAddress?.address?.toLowerCase() ?? "";
    if (!email || email === ownAddress.toLowerCase()) continue;
    const content = message.body?.content ?? "";
    results.push({
      threadId: message.conversationId ?? message.id,
      fromName: message.from?.emailAddress?.name ?? "",
      fromEmail: email,
      subject: message.subject ?? "",
      body:
        (message.body?.contentType === "html"
          ? htmlToText(content)
          : content.trim()) || "[message vide]",
      replyToMessageId: message.id,
      position: message.receivedDateTime ?? "",
    });
  }
  return results;
}

// ------------------------------------------------------------
// Envoi des réponses
// ------------------------------------------------------------

/** Encodage RFC 2047 d'un en-tête UTF-8 (sujets accentués). */
function encodeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Message MIME complet d'une réponse Gmail (threading inclus). */
export function buildGmailReplyMime(input: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
}): string {
  const subject = input.subject.trim().toLowerCase().startsWith("re:")
    ? input.subject.trim()
    : `Re: ${input.subject.trim() || "votre message"}`;
  const lines = [
    `To: ${input.to}`,
    `Subject: ${encodeHeader(subject)}`,
    ...(input.inReplyTo
      ? [`In-Reply-To: ${input.inReplyTo}`, `References: ${input.inReplyTo}`]
      : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(input.body, "utf8").toString("base64"),
  ];
  return lines.join("\r\n");
}

export async function sendGmailReply(
  accessToken: string,
  input: {
    to: string;
    subject: string;
    body: string;
    threadId: string;
    inReplyTo?: string;
  }
): Promise<void> {
  const raw = Buffer.from(buildGmailReplyMime(input), "utf8").toString(
    "base64url"
  );
  const response = await fetch(`${GMAIL}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw, threadId: input.threadId }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail ${response.status} : ${text.slice(0, 300)}`);
  }
}

export async function sendOutlookReply(
  accessToken: string,
  input: { messageId: string; body: string }
): Promise<void> {
  const response = await fetch(
    `${GRAPH}/me/messages/${encodeURIComponent(input.messageId)}/reply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: input.body }),
    }
  );
  // Graph répond 202 Accepted sans corps.
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Outlook ${response.status} : ${text.slice(0, 300)}`);
  }
}
