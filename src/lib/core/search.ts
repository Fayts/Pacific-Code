// Neutralisation des termes de recherche avant interpolation dans les
// filtres PostgREST (.or() / .ilike.) : les caractères réservés de la
// syntaxe de filtre et les jokers SQL sont remplacés par des espaces.
// À utiliser PARTOUT où une saisie utilisateur entre dans un filtre.

export function sanitizeSearchTerm(raw: string): string {
  return raw
    .replace(/[%,()"'*\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
