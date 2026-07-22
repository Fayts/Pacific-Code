// Démarre la connexion e-mail d'un loueur (Gmail ou Outlook) : construit
// l'URL du consentement OAuth avec un state signé (organisation +
// fournisseur + expiration). Le loueur n'a qu'à accepter dans la fenêtre
// Google / Microsoft.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  buildAuthUrl,
  emailProviderConfigured,
  signEmailOauthState,
} from "@/lib/email/server";
import { bearerToken, createTokenClient } from "@/lib/supabase/token-client";

export const runtime = "nodejs";

const requestSchema = z.object({
  provider: z.enum(["gmail", "outlook"]),
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

  if (!emailProviderConfigured(parsed.data.provider)) {
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
    .limit(1)
    .maybeSingle();
  if (!member) {
    return NextResponse.json(
      { error: "Aucune organisation active" },
      { status: 403 }
    );
  }

  const state = signEmailOauthState(
    member.organization_id,
    parsed.data.provider
  );
  return NextResponse.json({
    url: buildAuthUrl(parsed.data.provider, parsed.data.redirectUri, state),
  });
}
