// Appariement d'un message client avec la base de connaissances du loueur.
//
// 100 % déterministe : un score, pas un modèle de langage. Deux sources de
// points — les mots-clés déclencheurs saisis par le loueur (signal fort) et
// les mots significatifs de la question type (signal faible). En dessous du
// seuil, on ne répond PAS : mieux vaut transmettre au loueur qu'envoyer une
// réponse hors sujet.

import type { KnowledgeEntry } from "@/lib/types/inbox";
import { containsPhrase, containsWord, normalize, tokens } from "@/lib/ai/text";

export type KnowledgeMatch = {
  entry: KnowledgeEntry;
  score: number;
  /** Ce qui a déclenché l'appariement — affiché dans l'écran de test. */
  matched: string[];
};

/** Mots vides français : présents partout, ils ne prouvent rien. */
const STOPWORDS = new Set([
  "alors", "aussi", "autre", "avec", "avez", "avoir", "bonjour", "bonsoir",
  "cela", "cette", "chez", "comme", "comment", "dans", "donc", "elle",
  "encore", "est", "etre", "fait", "faire", "juste", "leur", "mais", "merci",
  "meme", "nous", "pour", "pouvez", "pourriez", "quand", "que", "quel",
  "quelle", "quelles", "quels", "qui", "sans", "sont", "sur", "tout",
  "toute", "toutes", "tous", "tres", "vers", "voudrais", "vos", "votre",
  "vous", "etes", "peut", "peux", "plus", "moins", "bien", "faut",
]);

/** Un mot-clé touché suffit à atteindre le seuil : c'est le signal fort. */
const KEYWORD_HIT = 3;
/** Un mot-clé en plusieurs mots est plus spécifique : il vaut davantage. */
const PHRASE_BONUS = 1;
/** Les mots de la question type ne comptent qu'en appoint. */
const QUESTION_TOKEN_HIT = 1;
/** Plafond des points venant de la question type (évite qu'une question
 *  longue gagne par accumulation de mots banals). */
const MAX_QUESTION_POINTS = 3;
/** Les mots courts sont trop ambigus pour servir de preuve. */
const MIN_QUESTION_TOKEN_LENGTH = 4;
/** Score minimal pour oser répondre. */
export const MIN_KNOWLEDGE_SCORE = 3;

function scoreEntry(
  normalizedText: string,
  entry: KnowledgeEntry
): { score: number; matched: string[] } {
  const matched: string[] = [];
  let score = 0;

  for (const keyword of entry.keywords) {
    const clean = keyword.trim();
    if (!clean) continue;
    if (containsPhrase(normalizedText, clean)) {
      const words = tokens(clean).length;
      score += KEYWORD_HIT + (words > 1 ? PHRASE_BONUS : 0);
      matched.push(clean);
    }
  }

  let questionPoints = 0;
  const seen = new Set<string>();
  for (const token of tokens(entry.question, MIN_QUESTION_TOKEN_LENGTH)) {
    if (seen.has(token) || STOPWORDS.has(token)) continue;
    seen.add(token);
    if (questionPoints >= MAX_QUESTION_POINTS) break;
    if (containsWord(normalizedText, token)) {
      questionPoints += QUESTION_TOKEN_HIT;
      matched.push(token);
    }
  }
  score += questionPoints;

  // La priorité ne crée jamais un appariement, elle départage.
  if (score > 0) score += entry.priority;

  return { score, matched };
}

/**
 * Toutes les entrées actives ayant marqué au moins un point, les meilleures
 * d'abord. Sert l'écran de test : le loueur voit ce que l'agent a hésité à
 * répondre, pas seulement le gagnant.
 */
export function rankKnowledge(
  message: string,
  entries: KnowledgeEntry[]
): KnowledgeMatch[] {
  const normalized = normalize(message);
  if (!normalized.trim()) return [];
  return entries
    .filter((entry) => entry.is_active)
    .map((entry) => ({ entry, ...scoreEntry(normalized, entry) }))
    .filter((match) => match.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.entry.priority - a.entry.priority ||
        a.entry.question.length - b.entry.question.length ||
        a.entry.question.localeCompare(b.entry.question)
    );
}

/** La réponse à envoyer, ou null si rien n'est assez sûr. */
export function matchKnowledge(
  message: string,
  entries: KnowledgeEntry[]
): KnowledgeMatch | null {
  const best = rankKnowledge(message, entries)[0];
  return best && best.score >= MIN_KNOWLEDGE_SCORE ? best : null;
}
