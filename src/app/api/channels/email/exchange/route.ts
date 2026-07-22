// Fin de la connexion e-mail : échange le code OAuth contre les jetons,
// identifie l'adresse du compte et enregistre la connexion. Le fournisseur
// est porté par le state signé — jamais choisi par le navigateur au retour.
// Les jetons sont stockés en base via une fonction SECURITY DEFINER.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  emailProviderConfigured,
  exchangeCode,
  fetchAccountAddress,
  verifyEmailOauthState,
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
  code: z.string().min(1).max(4000),
  state: z.string().min(1).max(1000),
  redirectUri: z.string().url().max(500),
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
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const stateData = verifyEmailOauthState(parsed.data.state);
  if (!stateData) {
    return NextResponse.json(
      { error: "Connexion expirée — relancez la connexion du canal." },
      { status: 400 }
    );
  }
  const { orgId, provider } = stateData;
  if (!emailProviderConfigured(provider)) {
    return NextResponse.json(
      { error: "Ce canal e-mail n'est pas configuré sur ce serveur." },
      { status: 501 }
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
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!member) {
    return NextResponse.json(
      { error: "Organisation invalide pour cette connexion." },
      { status: 403 }
    );
  }

  try {
    const tokens = await exchangeCode(
      provider,
      parsed.data.code,
      parsed.data.redirectUri
    );
    if (!tokens.refreshToken) {
      throw new Error(
        "Le fournisseur n'a pas émis d'autorisation durable — retirez l'accès de l'application dans votre compte, puis reconnectez-vous."
      );
    }
    const address = await fetchAccountAddress(provider, tokens.accessToken);

    // Point de reprise initial : seuls les messages reçus APRÈS la
    // connexion sont relevés (pas d'ingestion de l'historique).
    const cursor =
      provider === "gmail"
        ? String(Math.floor(Date.now() / 1000))
        : new Date().toISOString();

    const { error: storeError } = await rawRpc(supabase, "store_email_account", {
      p_organization_id: orgId,
      p_provider: provider,
      p_address: address,
      p_refresh_token: tokens.refreshToken,
      p_access_token: tokens.accessToken,
      p_expires_at: tokens.expiresAt,
      p_cursor: cursor,
    });
    if (storeError) throw new Error(storeError.message);

    const { error: connectionError } = await rawTable(
      supabase,
      "channel_connections"
    ).upsert(
      {
        organization_id: orgId,
        channel: provider,
        status: "connected",
        display_name: address,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,channel" }
    );
    if (connectionError) throw new Error(connectionError.message);

    return NextResponse.json({ provider, address });
  } catch (err) {
    console.error("email exchange error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error && err.message
            ? err.message
            : "Connexion du compte e-mail impossible — réessayez.",
      },
      { status: 502 }
    );
  }
}
