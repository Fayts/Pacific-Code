// Analyse d'un texte d'activité côté serveur.
// La logique (IA validée Zod ou parseur déterministe) vit dans
// src/lib/import/parse-server.ts, partagée avec l'import site web et
// l'import Page Facebook. Les clés API ne quittent jamais le serveur.

import { NextResponse, type NextRequest } from "next/server";
import { parseRequestSchema } from "@/lib/validations/import";
import { parseBusinessText } from "@/lib/import/parse-server";
import { checkRateLimit, clientAddress } from "@/lib/core/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

// Route non authentifiée (onboarding) : le débit est plafonné par adresse
// pour empêcher l'épuisement du crédit LLM quand une clé IA est configurée.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 5 * 60_000;

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(
    `import-parse:${clientAddress(request.headers)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS
  );
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes, réessayez dans quelques minutes" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const parsed = parseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Texte manquant ou trop long (20 000 caractères max)" },
      { status: 400 }
    );
  }

  const { mode, result } = await parseBusinessText(parsed.data.text);
  return NextResponse.json({ mode, result });
}
