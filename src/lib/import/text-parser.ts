// Parseur déterministe de descriptions et d'annonces en français.
// Sert de moteur au mode démonstration de l'assistant IA : aucune valeur
// n'est inventée — ce qui n'est pas détecté reste « à compléter ».

import type { ParsedBusiness, ParsedItem } from "@/lib/types/import";
import {
  localId,
  parsePrice,
  parseQuantity,
} from "@/lib/import/normalize";

export const MAX_TEXT_LENGTH = 20_000;
export const MAX_ITEMS_PER_IMPORT = 100;

// Catégorie inférée par mots-clés (ordre = priorité).
const CATEGORY_KEYWORDS: Array<{ category: string; individual: boolean; words: string[] }> = [
  { category: "Scooters", individual: true, words: ["scooter", "pcx", "vespa", "125cc", "125 cc"] },
  { category: "Motos", individual: true, words: ["moto", "motocyclette"] },
  { category: "Voitures", individual: true, words: ["voiture", "citadine", "yaris", "hilux", "4x4", "suv", "berline", "pick-up", "pickup", "auto"] },
  { category: "Bateaux", individual: true, words: ["bateau", "poti marara", "semi-rigide", "zodiac"] },
  { category: "Nautique", individual: false, words: ["paddle", "kayak", "surf", "bodyboard", "palmes", "masque"] },
  { category: "Logements", individual: true, words: ["logement", "bungalow", "studio", "maison", "villa", "f1", "f2", "f3", "appartement", "fare"] },
  { category: "Événementiel", individual: false, words: ["table", "chaise", "tente", "barnum", "sono", "chapiteau", "estrade"] },
  { category: "Matériel", individual: false, words: ["karcher", "kärcher", "puzzi", "nettoyeur", "injecteur", "extracteur", "perceuse", "groupe electrogene", "groupe électrogène", "betonniere", "bétonnière", "echafaudage", "échafaudage", "tondeuse", "debroussailleuse", "débroussailleuse", "aspirateur", "shampouineuse"] },
];

function inferCategory(name: string): { category: string; individual: boolean } | null {
  const lower = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  for (const entry of CATEGORY_KEYWORDS) {
    if (
      entry.words.some((w) =>
        lower.includes(
          w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
        )
      )
    ) {
      return { category: entry.category, individual: entry.individual };
    }
  }
  return null;
}

const PRICE_UNIT = String.raw`(?:xpf|f\s*cfp|fcfp|francs?)`;
// « 3 scooters Honda PCX à 6 000 XPF (par jour) » / « Kärcher Puzzi : 7 990 XPF »
const ITEM_PATTERN = new RegExp(
  String.raw`(?:(\d{1,4}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+)?` + // quantité
    String.raw`([a-zà-ÿ0-9][a-zà-ÿ0-9 '’./-]{2,60}?)` + // nom
    String.raw`\s*(?:à|:|au prix de|pour)\s*` +
    String.raw`([\d][\d\s.,  ]{2,12})\s*` + // prix
    PRICE_UNIT +
    String.raw`(?:\s*(?:par jour|\/\s*jour|la journée|jour))?`,
  "gi"
);

const DEPOSIT_PATTERN = new RegExp(
  String.raw`caution\s*(?:de|:|est de)?\s*([\d][\d\s.,  ]{2,12})\s*` + PRICE_UNIT,
  "i"
);

const LEAD_WORDS =
  /^(?:nous\s+proposons|nous\s+louons|location(?:\s+de)?|louez|je\s+loue|je\s+propose|proposons|de|des|du|d'|l'|le|la|les|et|ou|avec|:)\s+/i;

function cleanItemName(raw: string): string {
  let name = raw.trim().replace(/\s+/g, " ");
  let previous = "";
  while (previous !== name) {
    previous = name;
    name = name.replace(LEAD_WORDS, "").trim();
  }
  return name;
}

export type TextParseResult = {
  items: ParsedItem[];
  business: Partial<ParsedBusiness>;
  /** Vrai si une caution globale a été répartie (confiance « probable »). */
  appliedGlobalDeposit: boolean;
};

/** Analyse un texte libre (description d'activité ou annonces collées). */
export function parseCatalogText(input: string): TextParseResult {
  const text = input.slice(0, MAX_TEXT_LENGTH).replace(/[  ]/g, " ");
  const items: ParsedItem[] = [];

  for (const match of text.matchAll(ITEM_PATTERN)) {
    if (items.length >= MAX_ITEMS_PER_IMPORT) break;
    const [, qtyRaw, nameRaw, priceRaw] = match;
    let name = cleanItemName(nameRaw);
    let quantity = parseQuantity(qtyRaw ?? "") ?? 1;
    // La quantité est souvent absorbée par le nom (« Nous proposons 3
    // scooters… ») : on l'extrait après nettoyage des mots d'amorce.
    const lead = name.match(
      /^(\d{1,4}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)\s+(.+)$/i
    );
    if (lead) {
      const q = parseQuantity(lead[1]);
      if (q !== null) {
        quantity = q;
        name = lead[2];
      }
    }
    // « scooters Honda PCX » → « scooter Honda PCX » (pluriel générique).
    name = name.replace(/^([a-zà-ÿ]{3,})s(\s|$)/i, "$1$2");
    name = name.charAt(0).toUpperCase() + name.slice(1);
    if (!name || name.length < 3) continue;
    const price = parsePrice(priceRaw);
    const inferred = inferCategory(name);
    items.push({
      id: localId(),
      name,
      categoryName: inferred?.category ?? "",
      tracking: inferred?.individual && quantity > 1 ? "individual" : "stock",
      quantity,
      dailyPrice: price,
      pricingMode: "daily",
      depositAmount: null,
      minRentalDays: 1,
      internalRef: "",
      description: "",
      internalNotes: "",
      priceConfidence: price === null ? "missing" : "detected",
      depositConfidence: "missing",
      duplicateOfId: null,
      duplicateOfName: null,
      duplicateResolution: "create",
      excluded: false,
    });
  }

  // Caution : rattachée à un bien si elle figure dans la même « annonce »
  // (bloc séparé par des lignes vides), sinon répartie en « probable ».
  let appliedGlobalDeposit = false;
  const blocks = text.split(/\n\s*\n/);
  const depositByBlock = blocks
    .map((block) => ({
      deposit: DEPOSIT_PATTERN.exec(block)?.[1] ?? null,
      block,
    }))
    .filter((b) => b.deposit !== null);

  if (blocks.length > 1 && depositByBlock.length > 0) {
    for (const { deposit, block } of depositByBlock) {
      const amount = parsePrice(deposit);
      if (amount === null) continue;
      for (const item of items) {
        if (
          item.depositAmount === null &&
          block.toLowerCase().includes(item.name.toLowerCase().slice(0, 8))
        ) {
          item.depositAmount = amount;
          item.depositConfidence = "detected";
        }
      }
    }
  } else {
    const global = DEPOSIT_PATTERN.exec(text);
    if (global) {
      const amount = parsePrice(global[1]);
      if (amount !== null) {
        for (const item of items) {
          if (item.depositAmount === null) {
            item.depositAmount = amount;
            item.depositConfidence = "probable";
            appliedGlobalDeposit = true;
          }
        }
      }
    }
  }

  // Livraison / zones desservies.
  const delivery = text.match(/livraison[^.\n]*[.\n]?/i);
  const business: Partial<ParsedBusiness> = {};
  if (delivery) {
    business.deliveryNotes = delivery[0].trim().replace(/[.\n]$/, "");
  }

  return { items, business, appliedGlobalDeposit };
}
