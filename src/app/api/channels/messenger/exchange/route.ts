// Fin de la connexion Facebook : échange le code OAuth contre les jetons,
// récupère la Page du loueur, active les webhooks de la Page et enregistre
// la connexion. Le jeton de page est stocké en base via une fonction
// SECURITY DEFINER — jamais renvoyé au navigateur.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  exchangeCodeForUserToken,
  listGrantedPermissions,
  listPagesViaGrantedScopes,
  listUserPages,
  messengerConfigured,
  subscribePageToWebhooks,
  verifyOauthState,
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
  code: z.string().min(1).max(2000),
  state: z.string().min(1).max(1000),
  redirectUri: z.string().url().max(500),
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
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  // Le state signé doit correspondre à l'organisation de l'utilisateur.
  const stateOrgId = verifyOauthState(parsed.data.state);
  if (!stateOrgId) {
    return NextResponse.json(
      { error: "Connexion expirée — relancez « Connecter Facebook »." },
      { status: 400 }
    );
  }
  const supabase = createTokenClient(token);
  const { data: userData } = await supabase.auth.getUser(token);
  if (!userData.user) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }
  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userData.user.id)
    .eq("organization_id", stateOrgId)
    .maybeSingle();
  if (!member) {
    return NextResponse.json(
      { error: "Organisation invalide pour cette connexion." },
      { status: 403 }
    );
  }

  try {
    const userToken = await exchangeCodeForUserToken(
      parsed.data.code,
      parsed.data.redirectUri
    );
    let pages = await listUserPages(userToken);
    if (pages.length === 0) {
      // Page détenue par un portefeuille business : /me/accounts peut être
      // vide malgré l'accord — repli sur les granular scopes du jeton.
      pages = await listPagesViaGrantedScopes(userToken);
    }
    if (pages.length === 0) {
      // Diagnostic : quelles autorisations Facebook a-t-il réellement accordées ?
      const granted = await listGrantedPermissions(userToken);
      return NextResponse.json(
        {
          error:
            "Aucune Page Facebook renvoyée par Meta. Autorisations accordées : " +
            (granted.length > 0 ? granted.join(", ") : "aucune") +
            ". Il manque probablement « pages_show_list » — relancez la connexion et validez tous les écrans Facebook.",
        },
        { status: 400 }
      );
    }
    // Une seule Page dans la quasi-totalité des cas : la première est prise.
    const page = pages[0];

    await subscribePageToWebhooks(page.id, page.access_token);

    const { error: storeError } = await rawRpc(supabase, "store_messenger_page", {
      p_organization_id: stateOrgId,
      p_page_id: page.id,
      p_page_name: page.name,
      p_access_token: page.access_token,
    });
    if (storeError) throw new Error(storeError.message);

    const { error: connectionError } = await rawTable(
      supabase,
      "channel_connections"
    ).upsert(
      {
        organization_id: stateOrgId,
        channel: "messenger",
        status: "connected",
        display_name: page.name,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,channel" }
    );
    if (connectionError) throw new Error(connectionError.message);

    return NextResponse.json({
      pageName: page.name,
      otherPages: pages.slice(1).map((p) => p.name),
    });
  } catch (err) {
    console.error("messenger exchange error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error && err.message
            ? err.message
            : "Connexion Facebook impossible — réessayez.",
      },
      { status: 502 }
    );
  }
}
