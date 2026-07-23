// Outils de comparaison de texte français partagés par l'Agent IA :
// normalisation (minuscules, accents, apostrophes typographiques),
// découpage en mots et recherche de mot entier.
//
// Extraits d'agent-engine.ts pour être réutilisés à l'identique par
// l'appariement de la base de connaissances — même normalisation des deux
// côtés, sinon les mots-clés saisis avec accents ne matcheraient jamais.

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const TYPOGRAPHIC_QUOTES = new RegExp("[\\u2019\\u2018]", "g");

/** Minuscules, sans accents, apostrophes typographiques ramenées à «'». */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(TYPOGRAPHIC_QUOTES, "'");
}

/** Mots normalisés d'au moins `minLength` caractères. */
export function tokens(value: string, minLength = 2): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= minLength);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Vrai si `token` apparaît comme mot entier dans un texte DÉJÀ normalisé. */
export function containsWord(text: string, token: string): boolean {
  return new RegExp(`\\b${escapeRegExp(token)}\\b`).test(text);
}

/**
 * Vrai si `phrase` (un ou plusieurs mots) apparaît dans un texte DÉJÀ
 * normalisé, en respectant les frontières de mots.
 */
export function containsPhrase(text: string, phrase: string): boolean {
  const parts = tokens(phrase);
  if (parts.length === 0) return false;
  if (parts.length === 1) return containsWord(text, parts[0]);
  return new RegExp(
    `\\b${parts.map(escapeRegExp).join("[^a-z0-9]+")}\\b`
  ).test(text);
}
