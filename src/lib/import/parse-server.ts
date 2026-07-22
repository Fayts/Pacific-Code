// Analyse serveur d'un texte d'activité — partagée par les routes d'import
// (/api/import/parse, /api/import/website, /api/import/facebook-page).
// Clé IA configurée : generateObject + validation Zod stricte ; sinon parseur
// déterministe (mode démonstration, signalé). L'IA ne renvoie que du JSON
// validé — jamais d'écriture en base depuis ces routes.

import { generateObject } from "ai";
import { resolveProvider } from "@/lib/ai/provider";
import {
  aiParseResultSchema,
  type AiParseResult,
} from "@/lib/validations/import";
import { parseCatalogText } from "@/lib/import/text-parser";

const SYSTEM_PROMPT = `Tu analyses la description d'une activité de location en Polynésie française pour préparer un catalogue.
Extrait uniquement ce qui est écrit — n'invente JAMAIS un prix, une caution ou une quantité.
Prix en XPF (nombres entiers). Une valeur incertaine reçoit la confiance "probable" ; une valeur absente reste null avec confiance "missing".
tracking "individual" pour les biens à identité propre (véhicules, bateaux, logements), "stock" pour les biens interchangeables.`;

export async function parseBusinessText(
  text: string,
  hint?: string
): Promise<{ mode: "ai" | "demo"; result: AiParseResult }> {
  const provider = resolveProvider();

  if (provider.mode === "llm") {
    try {
      const { object } = await generateObject({
        model: provider.model,
        schema: aiParseResultSchema,
        system: hint ? `${SYSTEM_PROMPT}\n${hint}` : SYSTEM_PROMPT,
        prompt: text,
        abortSignal: AbortSignal.timeout(25_000),
      });
      return { mode: "ai", result: object };
    } catch (error) {
      // Repli déterministe : le parcours ne doit jamais être bloqué par l'IA.
      console.error(
        "[import/parse] échec IA, repli déterministe :",
        error instanceof Error ? error.message : "erreur inconnue"
      );
    }
  }

  const fallback = parseCatalogText(text);
  return {
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
  };
}
