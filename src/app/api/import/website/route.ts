// Import réel depuis le site web du loueur : lecture serveur des pages
// publiques (garde-fous dans src/lib/import/website.ts) puis analyse par
// le pipeline partagé. Authentifié (mode Supabase uniquement) et plafonné :
// cette route déclenche des requêtes sortantes et des appels IA.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { collectSiteText, WebsiteImportError } from "@/lib/import/website";
import { parseBusinessText } from "@/lib/import/parse-server";
import { checkRateLimit, clientAddress } from "@/lib/core/rate-limit";
import { bearerToken, createTokenClient } from "@/lib/supabase/token-client";

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60_000;

const requestSchema = z.object({
  url: z.string().trim().min(4).max(300),
});

const AI_HINT =
  "Le texte provient des pages d'un site web : ignore les menus, bandeaux de cookies, mentions légales et éléments de navigation répétés.";

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(
    `import-website:${clientAddress(request.headers)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS
  );
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Trop de lectures de sites — réessayez dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      }
    );
  }

  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: "Import de site indisponible sur la version de démonstration." },
      { status: 501 }
    );
  }
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const supabase = createTokenClient(token);
  const { data: userData } = await supabase.auth.getUser(token);
  if (!userData.user) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Adresse invalide" }, { status: 400 });
  }
  const rawUrl = /^https?:\/\//i.test(parsed.data.url)
    ? parsed.data.url
    : `https://${parsed.data.url}`;

  try {
    const site = await collectSiteText(rawUrl);
    const { mode, result } = await parseBusinessText(site.text, AI_HINT);
    return NextResponse.json({ mode, result, pages: site.pages });
  } catch (error) {
    if (error instanceof WebsiteImportError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error(
      "[import/website] échec :",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      {
        error:
          "Lecture du site impossible — réessayez, ou utilisez la méthode « brochure ou photo ».",
      },
      { status: 502 }
    );
  }
}
