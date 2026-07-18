// Normalisation des valeurs importées (prix XPF, quantités, noms).

/** "7 990 XPF", "7.990 F", "6000", "9 000 fcfp" → nombre entier, sinon null. */
export function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = String(raw)
    // Espaces insécables (fine ou non) → espace simple.
    .replace(/[  ]/g, " ")
    .replace(/xpf|f\s*cfp|fcfp|francs?|cfp/gi, "")
    // Séparateurs de milliers : "7 990" / "7.990" → "7990".
    .replace(/(?<=\d)[\s.](?=\d{3}\b)/g, "")
    .replace(",", ".")
    .trim();
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Math.round(Number(match[0]));
  if (!Number.isFinite(value) || value < 0 || value > 99_999_999) return null;
  return value;
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
};

/** "3", "trois", "x3" → entier ≥ 1, sinon null. */
export function parseQuantity(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const text = String(raw).trim().toLowerCase();
  if (text in NUMBER_WORDS) return NUMBER_WORDS[text];
  const match = text.match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  if (!Number.isInteger(value) || value < 1 || value > 10_000) return null;
  return value;
}

/** Clé de comparaison : minuscules, sans accents ni ponctuation superflue. */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Honda PCX" + 2/5 → "Honda PCX 02" (suffixe des biens individualisés). */
export function individualName(
  base: string,
  index: number,
  total: number
): string {
  const width = Math.max(2, String(total).length);
  return `${base} ${String(index).padStart(width, "0")}`;
}

let counter = 0;

/** Identifiant local (lignes de brouillon — pas un id base). */
export function localId(): string {
  counter += 1;
  return `imp_${Date.now().toString(36)}_${counter.toString(36)}`;
}
