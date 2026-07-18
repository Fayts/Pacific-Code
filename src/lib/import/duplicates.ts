// Détection de doublons : contre le parc existant et au sein de l'import.

import type { EquipmentItem } from "@/lib/types/database";
import type { ParsedItem } from "@/lib/types/import";
import { normalizeName } from "@/lib/import/normalize";

/** Marque duplicateOfId/Name sur chaque bien ressemblant à un existant. */
export function markDuplicates(
  items: ParsedItem[],
  existing: EquipmentItem[]
): ParsedItem[] {
  const byName = new Map<string, EquipmentItem>();
  const byRef = new Map<string, EquipmentItem>();
  for (const item of existing) {
    if (item.archived_at) continue;
    byName.set(normalizeName(item.name), item);
    if (item.internal_ref) byRef.set(normalizeName(item.internal_ref), item);
  }

  return items.map((item) => {
    const refKey = item.internalRef ? normalizeName(item.internalRef) : "";
    const match =
      (refKey && byRef.get(refKey)) || byName.get(normalizeName(item.name));
    if (match) {
      return {
        ...item,
        duplicateOfId: match.id,
        duplicateOfName: match.name,
        // Choix par défaut prudent : ne rien écraser sans décision explicite.
        duplicateResolution: item.duplicateResolution ?? "create",
      };
    }
    return { ...item, duplicateOfId: null, duplicateOfName: null };
  });
}

/** Ids des lignes en doublon entre elles au sein du brouillon. */
export function internalDuplicateIds(items: ParsedItem[]): Set<string> {
  const seen = new Map<string, string>();
  const dupes = new Set<string>();
  for (const item of items) {
    if (item.excluded) continue;
    const key = normalizeName(item.name);
    if (!key) continue;
    const firstId = seen.get(key);
    if (firstId) {
      dupes.add(firstId);
      dupes.add(item.id);
    } else {
      seen.set(key, item.id);
    }
  }
  return dupes;
}
