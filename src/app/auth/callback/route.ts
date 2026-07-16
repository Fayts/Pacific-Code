import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Échange le code PKCE (confirmation d'email, lien magique, récupération
// de mot de passe) contre une session, puis redirige.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=lien-invalide-ou-expire`
  );
}
