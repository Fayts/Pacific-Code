// Intégration Meta / Facebook Messenger — CÔTÉ SERVEUR UNIQUEMENT.
// L'App Secret et les jetons de page ne transitent jamais par le
// navigateur. Utilisé par les routes /api/channels/messenger/* et
// /api/webhooks/messenger.

// (module strictement serveur : importé uniquement par des routes API)
import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

export function facebookAppId(): string {
  const id = process.env.FACEBOOK_APP_ID;
  if (!id) throw new Error("FACEBOOK_APP_ID manquant");
  return id;
}

export function facebookAppSecret(): string {
  const secret = process.env.FACEBOOK_APP_SECRET;
  if (!secret) throw new Error("FACEBOOK_APP_SECRET manquant");
  return secret;
}

export function metaVerifyToken(): string {
  const token = process.env.META_VERIFY_TOKEN;
  if (!token) throw new Error("META_VERIFY_TOKEN manquant");
  return token;
}

export function webhookIngestSecret(): string {
  const secret = process.env.WEBHOOK_INGEST_SECRET;
  if (!secret) throw new Error("WEBHOOK_INGEST_SECRET manquant");
  return secret;
}

export function messengerConfigured(): boolean {
  return Boolean(
    process.env.FACEBOOK_APP_ID &&
      process.env.FACEBOOK_APP_SECRET &&
      process.env.WEBHOOK_INGEST_SECRET
  );
}

// ------------------------------------------------------------
// State OAuth signé (HMAC App Secret) : organisation + expiration.
// ------------------------------------------------------------

export function signOauthState(orgId: string): string {
  const payload = `${orgId}.${Date.now() + 10 * 60_000}`;
  const signature = createHmac("sha256", facebookAppSecret())
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyOauthState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [orgId, expiry, signature] = decoded.split(".");
    if (!orgId || !expiry || !signature) return null;
    if (Number(expiry) < Date.now()) return null;
    const expected = createHmac("sha256", facebookAppSecret())
      .update(`${orgId}.${expiry}`)
      .digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return orgId;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// Signature des webhooks Meta (X-Hub-Signature-256).
// ------------------------------------------------------------

export function verifyMetaSignature(
  rawBody: string,
  header: string | null
): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", facebookAppSecret())
    .update(Buffer.from(rawBody, "utf8"))
    .digest("hex");
  const received = header.slice("sha256=".length);
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ------------------------------------------------------------
// Graph API
// ------------------------------------------------------------

async function graph<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GRAPH}${path}`, init);
  const json = (await response.json()) as T & {
    error?: { message?: string };
  };
  if (!response.ok || json.error) {
    throw new Error(json.error?.message ?? `Graph API ${response.status}`);
  }
  return json;
}

/** Échange le code OAuth contre un jeton utilisateur longue durée. */
export async function exchangeCodeForUserToken(
  code: string,
  redirectUri: string
): Promise<string> {
  const short = await graph<{ access_token: string }>(
    `/oauth/access_token?client_id=${facebookAppId()}&client_secret=${facebookAppSecret()}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`
  );
  const long = await graph<{ access_token: string }>(
    `/oauth/access_token?grant_type=fb_exchange_token&client_id=${facebookAppId()}&client_secret=${facebookAppSecret()}&fb_exchange_token=${encodeURIComponent(short.access_token)}`
  );
  return long.access_token;
}

export type MessengerPage = {
  id: string;
  name: string;
  access_token: string;
};

/** Pages Facebook administrées par l'utilisateur connecté. */
export async function listUserPages(userToken: string): Promise<MessengerPage[]> {
  const result = await graph<{ data: MessengerPage[] }>(
    `/me/accounts?fields=id,name,access_token&limit=25&access_token=${encodeURIComponent(userToken)}`
  );
  return result.data ?? [];
}

/** Diagnostic : autorisations réellement accordées par l'utilisateur. */
export async function listGrantedPermissions(
  userToken: string
): Promise<string[]> {
  try {
    const result = await graph<{
      data: Array<{ permission: string; status: string }>;
    }>(`/me/permissions?access_token=${encodeURIComponent(userToken)}`);
    return (result.data ?? [])
      .filter((p) => p.status === "granted")
      .map((p) => p.permission);
  } catch {
    return [];
  }
}

/** Abonne la Page aux webhooks de l'app (réception des messages). */
export async function subscribePageToWebhooks(
  pageId: string,
  pageToken: string
): Promise<void> {
  await graph(`/${pageId}/subscribed_apps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscribed_fields: "messages",
      access_token: pageToken,
    }),
  });
}

/** Envoi d'un message texte Messenger (réponse à une conversation). */
export async function sendMessengerText(
  pageToken: string,
  recipientPsid: string,
  text: string
): Promise<void> {
  await graph(`/me/messages?access_token=${encodeURIComponent(pageToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      messaging_type: "RESPONSE",
      message: { text: text.slice(0, 2000) },
    }),
  });
}

/** Nom public de l'expéditeur (échoue silencieusement : nom facultatif). */
export async function fetchSenderName(
  pageToken: string,
  psid: string
): Promise<string> {
  try {
    const profile = await graph<{ first_name?: string; last_name?: string }>(
      `/${psid}?fields=first_name,last_name&access_token=${encodeURIComponent(pageToken)}`
    );
    return [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  } catch {
    return "";
  }
}
