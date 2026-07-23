// Client des analyses serveur (texte collé, site web, Page Facebook) :
// convertit les réponses validées en lignes de brouillon. Le texte collé
// garde un repli local déterministe ; site et Facebook n'en ont pas
// (le contenu vit côté serveur) et remontent une erreur claire.

import type { ParsedBusiness, ParsedItem } from "@/lib/types/import";
import { aiParseResultSchema, type AiParseResult } from "@/lib/validations/import";
import { parseCatalogText } from "@/lib/import/text-parser";
import { localId } from "@/lib/import/normalize";

export type AnalyzeOutcome = {
  mode: "ai" | "demo";
  items: ParsedItem[];
  business: Partial<ParsedBusiness>;
};

function toParsedItems(items: AiParseResult["items"]): ParsedItem[] {
  return items.map((item) => ({
    id: localId(),
    name: item.name,
    categoryName: item.categoryName,
    tracking: item.tracking,
    quantity: item.quantity,
    dailyPrice: item.dailyPrice,
    pricingMode: item.pricingMode,
    depositAmount: item.depositAmount,
    minRentalDays: 1,
    internalRef: "",
    description: item.description,
    internalNotes: "",
    priceConfidence: item.priceConfidence,
    depositConfidence: item.depositConfidence,
    duplicateOfId: null,
    duplicateOfName: null,
    duplicateResolution: "create",
    excluded: false,
  }));
}

export async function analyzeText(text: string): Promise<AnalyzeOutcome> {
  try {
    const response = await fetch("/api/import/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (response.ok) {
      const payload = (await response.json()) as {
        mode: "ai" | "demo";
        result: unknown;
      };
      const checked = aiParseResultSchema.safeParse(payload.result);
      if (checked.success) {
        return {
          mode: payload.mode,
          items: toParsedItems(checked.data.items),
          business: checked.data.business,
        };
      }
    }
  } catch {
    // Réseau indisponible : repli local ci-dessous.
  }

  const local = parseCatalogText(text);
  return { mode: "demo", items: local.items, business: local.business };
}

// ------------------------------------------------------------
// Analyses sans repli local : l'échec est signalé, jamais masqué.
// ------------------------------------------------------------

async function postForAnalysis(
  path: string,
  token: string | null,
  body: unknown
): Promise<{ payload: Record<string, unknown>; outcome: AnalyzeOutcome }> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Connexion au serveur impossible — vérifiez votre réseau.");
  }
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Le serveur n'a pas pu traiter la demande — réessayez."
    );
  }
  const checked = aiParseResultSchema.safeParse(payload.result);
  if (!checked.success) {
    throw new Error("Réponse d'analyse invalide — réessayez.");
  }
  return {
    payload,
    outcome: {
      mode: payload.mode === "demo" ? "demo" : "ai",
      items: toParsedItems(checked.data.items),
      business: checked.data.business,
    },
  };
}

/** Import réel du site web : lecture serveur + analyse. */
export async function analyzeWebsite(
  url: string,
  token: string | null
): Promise<AnalyzeOutcome & { pagesRead: number }> {
  const { payload, outcome } = await postForAnalysis(
    "/api/import/website",
    token,
    { url }
  );
  return {
    ...outcome,
    pagesRead: Array.isArray(payload.pages) ? payload.pages.length : 1,
  };
}

/** Import depuis la Page Facebook connectée (fiche + publications). */
export async function analyzeFacebookPage(
  token: string | null
): Promise<
  AnalyzeOutcome & { pageName: string | null; website: string | null }
> {
  const { payload, outcome } = await postForAnalysis(
    "/api/import/facebook-page",
    token,
    {}
  );
  return {
    ...outcome,
    pageName: typeof payload.pageName === "string" ? payload.pageName : null,
    website: typeof payload.website === "string" ? payload.website : null,
  };
}
