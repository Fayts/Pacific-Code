import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Convention Next.js 16 : proxy.ts remplace middleware.ts.
// Rafraîchit la session Supabase et protège les routes privées.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Tout sauf les ressources statiques.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
