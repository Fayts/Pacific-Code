// Problèmes et statuts de revue, calculés à la volée sur le brouillon.

import type {
  ItemIssue,
  ItemReviewState,
  ParsedItem,
} from "@/lib/types/import";

export function computeItemIssues(
  item: ParsedItem,
  internalDupes: Set<string>
): ItemIssue[] {
  const issues: ItemIssue[] = [];
  if (!item.name.trim()) {
    issues.push({
      level: "error",
      code: "missing_name",
      message: "Nom manquant",
    });
  }
  if (!Number.isInteger(item.quantity) || item.quantity < 1) {
    issues.push({
      level: "error",
      code: "invalid_quantity",
      message: "Quantité invalide",
    });
  }
  if (item.dailyPrice === null) {
    issues.push({
      level: "warning",
      code: "missing_price",
      message: "Prix journalier à compléter",
    });
  } else if (item.priceConfidence === "probable") {
    issues.push({
      level: "warning",
      code: "probable_price",
      message: "Prix détecté à vérifier",
    });
  }
  if (!item.categoryName.trim()) {
    issues.push({
      level: "warning",
      code: "missing_category",
      message: "Catégorie à choisir",
    });
  }
  if (item.depositAmount !== null && item.depositConfidence === "probable") {
    issues.push({
      level: "info",
      code: "probable_deposit",
      message: "Caution déduite du texte — à confirmer",
    });
  }
  if (item.duplicateOfId || internalDupes.has(item.id)) {
    issues.push({
      level: "info",
      code: "possible_duplicate",
      message: item.duplicateOfName
        ? `Ressemble à « ${item.duplicateOfName} »`
        : "Doublon possible dans cet import",
    });
  }
  return issues;
}

export function itemReviewState(
  item: ParsedItem,
  issues: ItemIssue[]
): ItemReviewState {
  if (issues.some((i) => i.level === "error")) return "error";
  if (item.duplicateOfId && item.duplicateResolution === "create") {
    return "duplicate";
  }
  if (issues.some((i) => i.code === "missing_price" || i.code === "missing_category")) {
    return "incomplete";
  }
  if (issues.some((i) => i.level === "warning" || i.code === "probable_deposit")) {
    return "to_verify";
  }
  return "ready";
}
