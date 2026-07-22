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
  console.error(
    `[messenger] /me/accounts: ${result.data?.length ?? 0} page(s)`
  );
  return result.data ?? [];
}

/**
 * Pages accordées via les « granular scopes » du jeton — la voie fiable
 * quand la Page appartient à un portefeuille business : /me/accounts peut
 * renvoyer une liste vide alors que l'accès à la Page a bien été accordé.
 */
export async function listPagesViaGrantedScopes(
  userToken: string
): Promise<MessengerPage[]> {
  const appToken = `${facebookAppId()}|${facebookAppSecret()}`;
  const debug = await graph<{
    data?: {
      granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
    };
  }>(
    `/debug_token?input_token=${encodeURIComponent(userToken)}&access_token=${encodeURIComponent(appToken)}`
  );

  console.error(
    "[messenger] debug_token granular_scopes:",
    JSON.stringify(debug.data?.granular_scopes ?? null)
  );

  const pageIds = new Set<string>();
  for (const granular of debug.data?.granular_scopes ?? []) {
    if (
      ["pages_messaging", "pages_show_list", "pages_manage_metadata"].includes(
        granular.scope
      )
    ) {
      for (const id of granular.target_ids ?? []) pageIds.add(id);
    }
  }

  const pages: MessengerPage[] = [];
  for (const id of pageIds) {
    try {
      const page = await graph<{
        id: string;
        name: string;
        access_token?: string;
      }>(
        `/${id}?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`
      );
      console.error(
        `[messenger] page ${id}: name=${page.name} token=${page.access_token ? "oui" : "NON"}`
      );
      if (page.access_token) {
        pages.push({
          id: page.id,
          name: page.name,
          access_token: page.access_token,
        });
      }
    } catch (err) {
      console.error(
        `[messenger] page ${id} inaccessible:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  return pages;
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

/** Fiche publique de la Page (import des informations de l'entreprise). */
export type FacebookPageProfile = {
  id: string;
  name?: string;
  about?: string;
  description?: string;
  phone?: string;
  emails?: string[];
  website?: string;
  single_line_address?: string;
  category?: string;
};

export async function fetchPageProfile(
  pageId: string,
  pageToken: string
): Promise<FacebookPageProfile> {
  return graph<FacebookPageProfile>(
    `/${pageId}?fields=name,about,description,phone,emails,website,single_line_address,category&access_token=${encodeURIComponent(pageToken)}`
  );
}

/** Textes des publications récentes de la Page (tarifs, annonces…). */
export async function fetchPagePosts(
  pageId: string,
  pageToken: string,
  limit = 25
): Promise<string[]> {
  try {
    const result = await graph<{ data?: Array<{ message?: string }> }>(
      `/${pageId}/posts?fields=message&limit=${limit}&access_token=${encodeURIComponent(pageToken)}`
    );
    return (result.data ?? [])
      .map((post) => post.message?.trim() ?? "")
      .filter((message) => message.length > 0);
  } catch {
    // Publications inaccessibles : l'import se limite à la fiche de la Page.
    return [];
  }
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
