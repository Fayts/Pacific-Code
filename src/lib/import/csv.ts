// Parseur CSV maison (aucune dépendance) : guillemets, séparateur auto
// (";" "," ou tabulation), retours ligne dans les cellules.

import type { ParsedItem } from "@/lib/types/import";
import { localId, parsePrice, parseQuantity } from "@/lib/import/normalize";

export const MAX_CSV_SIZE = 1024 * 1024; // 1 Mo
export const MAX_CSV_ROWS = 500;

export type CsvTable = {
  headers: string[];
  rows: string[][];
  delimiter: string;
};

function detectDelimiter(firstLine: string): string {
  const counts: Array<[string, number]> = [";", ",", "\t"].map((d) => [
    d,
    firstLine.split(d).length - 1,
  ]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ";";
}

/** Découpe un texte CSV complet en table (1re ligne = en-têtes). */
export function parseCsv(text: string): CsvTable {
  const content = text.replace(/^﻿/, "");
  const firstLineEnd = content.search(/\r?\n/);
  const delimiter = detectDelimiter(
    firstLineEnd === -1 ? content : content.slice(0, firstLineEnd)
  );

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && content[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);

  const headers = (rows.shift() ?? []).map((h) => h.trim());
  return { headers, rows, delimiter };
}

// ------------------------------------------------------------
// Association colonnes → champs du SaaS
// ------------------------------------------------------------

export type ImportField =
  | "name"
  | "category"
  | "internalRef"
  | "description"
  | "quantity"
  | "dailyPrice"
  | "depositAmount"
  | "minRentalDays"
  | "notes"
  | "ignore";

export const FIELD_LABELS: Record<ImportField, string> = {
  name: "Nom du bien",
  category: "Catégorie",
  internalRef: "Référence interne",
  description: "Description",
  quantity: "Quantité",
  dailyPrice: "Prix journalier",
  depositAmount: "Caution",
  minRentalDays: "Durée minimale (jours)",
  notes: "Remarques",
  ignore: "— Ignorer cette colonne —",
};

const FIELD_SYNONYMS: Record<Exclude<ImportField, "ignore">, string[]> = {
  name: ["nom", "designation", "désignation", "bien", "materiel", "matériel", "titre", "libelle", "libellé", "article", "name"],
  category: ["categorie", "catégorie", "type", "famille", "category"],
  internalRef: ["reference", "référence", "ref", "réf", "sku", "code", "immatriculation"],
  description: ["description", "détail", "detail", "descriptif"],
  quantity: ["quantite", "quantité", "qte", "qté", "stock", "nombre", "unités", "unites", "qty"],
  dailyPrice: ["prix journalier", "prix jour", "prix/jour", "tarif journalier", "tarif jour", "prix par jour", "prix", "tarif", "daily"],
  depositAmount: ["caution", "depot", "dépôt", "garantie", "deposit"],
  minRentalDays: ["duree minimale", "durée minimale", "jours min", "duree min", "durée min", "min jours"],
  notes: ["remarques", "notes", "commentaire", "commentaires", "observations"],
};

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, " ")
    .trim();
}

/** Propose automatiquement un champ pour chaque colonne du fichier. */
export function autoMapColumns(headers: string[]): ImportField[] {
  const used = new Set<ImportField>();
  return headers.map((header) => {
    const h = normalizeHeader(header);
    if (!h) return "ignore";
    for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS) as Array<
      [Exclude<ImportField, "ignore">, string[]]
    >) {
      if (used.has(field)) continue;
      if (synonyms.some((s) => h === normalizeHeader(s) || h.includes(normalizeHeader(s)))) {
        used.add(field);
        return field;
      }
    }
    return "ignore";
  });
}

/** Transforme les lignes CSV mappées en biens de brouillon. */
export function rowsToItems(
  table: CsvTable,
  mapping: ImportField[]
): ParsedItem[] {
  const index = (field: ImportField) => mapping.indexOf(field);
  const get = (row: string[], field: ImportField): string => {
    const i = index(field);
    return i === -1 ? "" : (row[i] ?? "").trim();
  };

  return table.rows.slice(0, MAX_CSV_ROWS).map((row) => {
    const price = parsePrice(get(row, "dailyPrice"));
    const deposit = parsePrice(get(row, "depositAmount"));
    const quantity = parseQuantity(get(row, "quantity")) ?? 1;
    const minDays = parseQuantity(get(row, "minRentalDays")) ?? 1;
    return {
      id: localId(),
      name: get(row, "name"),
      categoryName: get(row, "category"),
      tracking: "stock",
      quantity,
      dailyPrice: price,
      depositAmount: deposit,
      minRentalDays: minDays,
      internalRef: get(row, "internalRef"),
      description: get(row, "description"),
      internalNotes: get(row, "notes"),
      priceConfidence: price === null ? "missing" : "detected",
      depositConfidence: deposit === null ? "missing" : "detected",
      duplicateOfId: null,
      duplicateOfName: null,
      duplicateResolution: "create",
      excluded: false,
    } satisfies ParsedItem;
  });
}
