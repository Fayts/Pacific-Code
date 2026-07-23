// Service Base de connaissances de l'Agent IA : toutes les écritures
// passent ici (validation, normalisation des mots-clés), le repository ne
// fait que persister.
//
// Les mots-clés sont la partie sensible : ce sont eux qui déclenchent une
// réponse automatique. On les nettoie (vides, doublons, casse) avant de
// les stocker, sinon l'appariement devient imprévisible pour le loueur.

import { z } from "zod";
import { getDataProvider } from "@/lib/data";
import type { DataProvider } from "@/lib/data/repositories";
import type { KnowledgeEntry } from "@/lib/types/inbox";
import {
  actionError,
  actionOk,
  toUserMessage,
  zodError,
  type ActionResult,
} from "@/server/action-result";

/** Catégories proposées dans l'écran de gestion (la saisie reste libre). */
export const KNOWLEDGE_CATEGORIES = [
  "general",
  "paiement",
  "caution",
  "livraison",
  "horaires",
  "location",
  "materiel",
] as const;

export const KNOWLEDGE_CATEGORY_LABELS: Record<string, string> = {
  general: "Général",
  paiement: "Paiement",
  caution: "Caution",
  livraison: "Livraison et retrait",
  horaires: "Horaires",
  location: "Conditions de location",
  materiel: "Matériel",
};

const entrySchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Question trop courte")
    .max(200, "Question trop longue"),
  answer: z
    .string()
    .trim()
    .min(3, "Réponse trop courte")
    .max(2000, "Réponse trop longue"),
  keywords: z
    .array(z.string().trim().min(2).max(60))
    .max(20, "20 mots-clés maximum"),
  category: z.string().trim().min(1).max(40),
  isActive: z.boolean(),
  priority: z.number().int().min(-10).max(10),
});

export type KnowledgeInput = z.input<typeof entrySchema>;

/** Coupe une saisie « mot1, mot2 ; mot3 » en mots-clés propres. */
export function parseKeywords(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const clean = part.trim().replace(/\s+/g, " ");
    if (clean.length < 2) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

export async function listKnowledge(
  provider: DataProvider = getDataProvider()
): Promise<KnowledgeEntry[]> {
  return provider.knowledge.list();
}

export async function createKnowledgeEntry(
  input: KnowledgeInput,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<KnowledgeEntry>> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  try {
    return actionOk(await provider.knowledge.create(parsed.data));
  } catch (err) {
    return actionError(toUserMessage(err, "Création impossible"));
  }
}

export async function updateKnowledgeEntry(
  id: string,
  input: Partial<KnowledgeInput>,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<KnowledgeEntry>> {
  const parsed = entrySchema.partial().safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  try {
    return actionOk(await provider.knowledge.update(id, parsed.data));
  } catch (err) {
    return actionError(toUserMessage(err, "Modification impossible"));
  }
}

export async function deleteKnowledgeEntry(
  id: string,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  try {
    await provider.knowledge.remove(id);
    return actionOk(undefined);
  } catch (err) {
    return actionError(toUserMessage(err, "Suppression impossible"));
  }
}
