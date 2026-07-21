// Démarre la connexion Facebook d'un loueur : construit l'URL du dialogue
// OAuth Meta avec un state signé (organisation + expiration). Le loueur
// n'a qu'à cliquer « Accepter » dans la fenêtre Facebook.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  facebookAppId,
  messengerConfigured,
  signOauthState,
} from "@/lib/messenger/server";
import { bearerToken, createTokenClient } from "@/lib/supabase/token-client";

export const runtime = "nodejs";

const requestSchema = z.object({
  redirectUri: z.string().url().max(500),
});

// pages_read_engagement est requis par Meta pour lire l'objet Page et
// obtenir son jeton (constaté en production : (#100) sans ce scope).
const OAUTH_SCOPES =
  "pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement";

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

  const supabase = createTokenClient(token);
  const { data: userData } = await supabase.auth.getUser(token);
  if (!userData.user) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }
  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();
  if (!member) {
    return NextResponse.json(
      { error: "Aucune organisation active" },
      { status: 403 }
    );
  }

  const state = signOauthState(member.organization_id);
  const params = new URLSearchParams({
    client_id: facebookAppId(),
    redirect_uri: parsed.data.redirectUri,
    state,
  });
  // Facebook Login for Business : une configuration (config_id) remplace
  // les scopes si elle est fournie ; sinon, dialogue classique par scopes.
  const configId = process.env.FACEBOOK_LOGIN_CONFIG_ID?.trim();
  if (configId) {
    params.set("config_id", configId);
  } else {
    params.set("scope", OAUTH_SCOPES);
    // Redemande les autorisations ajoutées depuis un précédent accord.
    params.set("auth_type", "rerequest");
  }

  return NextResponse.json({
    url: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`,
  });
}
