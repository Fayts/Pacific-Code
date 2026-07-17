import { NextResponse, type NextRequest } from "next/server";

// Mode MOCK : les données et la session vivent dans le navigateur
// (localStorage), il n'y a donc aucune session côté serveur à vérifier.
// La protection des routes est assurée côté client par <RequireSession>.
//
// Lors du branchement Supabase Cloud (post-MVP), ce proxy reprendra le
// rafraîchissement de session (@supabase/ssr) — voir la branche
// archive/supabase-v1 pour l'implémentation de référence.
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
