// Client de l'analyse serveur : convertit la réponse (IA ou démo) en
// lignes de brouillon. En cas d'échec réseau, repli local déterministe.

import type { ParsedBusiness, ParsedItem } from "@/lib/types/import";
import { aiParseResultSchema } from "@/lib/validations/import";
import { parseCatalogText } from "@/lib/import/text-parser";
import { localId } from "@/lib/import/normalize";

export type AnalyzeOutcome = {
  mode: "ai" | "demo";
  items: ParsedItem[];
  business: Partial<ParsedBusiness>;
};

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
          items: checked.data.items.map((item) => ({
            id: localId(),
            name: item.name,
            categoryName: item.categoryName,
            tracking: item.tracking,
            quantity: item.quantity,
            dailyPrice: item.dailyPrice,
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
          })),
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
