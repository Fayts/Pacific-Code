// Analyse d'un texte d'activité côté serveur.
// - Clé IA configurée (AI_PROVIDER) : generateObject + validation Zod stricte.
// - Sinon : parseur déterministe (mode démonstration, signalé dans la réponse).
// Les clés API ne quittent jamais le serveur ; l'IA ne renvoie que du JSON
// validé — jamais d'écriture en base depuis cette route.

import { NextResponse, type NextRequest } from "next/server";
import { generateObject } from "ai";
import { resolveProvider } from "@/lib/ai/provider";
import {
  aiParseResultSchema,
  parseRequestSchema,
} from "@/lib/validations/import";
import { parseCatalogText } from "@/lib/import/text-parser";
import { checkRateLimit, clientAddress } from "@/lib/core/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

// Route non authentifiée (onboarding) : le débit est plafonné par adresse
// pour empêcher l'épuisement du crédit LLM quand une clé IA est configurée.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 5 * 60_000;

const SYSTEM_PROMPT = `Tu analyses la description d'une activité de location en Polynésie française pour préparer un catalogue.
Extrait uniquement ce qui est écrit — n'invente JAMAIS un prix, une caution ou une quantité.
Prix en XPF (nombres entiers). Une valeur incertaine reçoit la confiance "probable" ; une valeur absente reste null avec confiance "missing".
tracking "individual" pour les biens à identité propre (véhicules, bateaux, logements), "stock" pour les biens interchangeables.`;

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

  const provider = resolveProvider();

  if (provider.mode === "llm") {
    try {
      const { object } = await generateObject({
        model: provider.model,
        schema: aiParseResultSchema,
        system: SYSTEM_PROMPT,
        prompt: parsed.data.text,
        abortSignal: AbortSignal.timeout(25_000),
      });
      return NextResponse.json({ mode: "ai", result: object });
    } catch (error) {
      // Repli déterministe : le parcours ne doit jamais être bloqué par l'IA.
      console.error(
        "[import/parse] échec IA, repli déterministe :",
        error instanceof Error ? error.message : "erreur inconnue"
      );
    }
  }

  const fallback = parseCatalogText(parsed.data.text);
  return NextResponse.json({
    mode: "demo",
    result: {
      items: fallback.items.map((item) => ({
        name: item.name,
        categoryName: item.categoryName,
        quantity: item.quantity,
        tracking: item.tracking,
        dailyPrice: item.dailyPrice,
        depositAmount: item.depositAmount,
        description: item.description,
        priceConfidence: item.priceConfidence,
        depositConfidence: item.depositConfidence,
      })),
      business: {
        name: null,
        phone: null,
        email: null,
        address: null,
        deliveryNotes: fallback.business.deliveryNotes ?? null,
      },
    },
  });
}
