// Import final : tout est validé AVANT la première écriture, puis créé
// séquentiellement avec rollback best-effort en cas d'échec — l'utilisateur
// ne se retrouve jamais avec un demi-catalogue sans explication.

import { getDataProvider } from "@/lib/data";
import type { DataProvider } from "@/lib/data/repositories";
import type { Organization } from "@/lib/types/database";
import { equipmentSchema } from "@/lib/validations/equipment";
import type { EquipmentInput } from "@/lib/validations/equipment";
import type {
  ImportReport,
  ImportSessionData,
  ParsedItem,
} from "@/lib/types/import";
import { individualName, normalizeName } from "@/lib/import/normalize";
import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/server/action-result";

const FALLBACK_CATEGORY = "Autre";

function toEquipmentInput(
  item: ParsedItem,
  name: string,
  quantity: number,
  categoryId: string | null
): EquipmentInput {
  return {
    name,
    categoryId,
    internalRef: item.internalRef,
    description: item.description,
    dailyPrice: item.dailyPrice ?? 0,
    depositAmount: item.depositAmount ?? 0,
    quantityTotal: quantity,
    minRentalDays: item.minRentalDays,
    status: "available",
    usageInstructions: "",
    internalNotes: item.internalNotes,
  };
}

/** Décompose un bien du brouillon en fiches matérielles à créer. */
function expandItem(item: ParsedItem): Array<{ name: string; quantity: number }> {
  if (item.tracking === "individual" && item.quantity > 1) {
    return Array.from({ length: item.quantity }, (_, i) => ({
      name: individualName(item.name.trim(), i + 1, item.quantity),
      quantity: 1,
    }));
  }
  return [{ name: item.name.trim(), quantity: item.quantity }];
}

export async function runImport(
  session: ImportSessionData,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<ImportReport>> {
  const items = session.items.filter(
    (i) => !i.excluded && i.duplicateResolution !== "skip"
  );
  const skippedItems = session.items.length - items.length;

  if (
    items.length === 0 &&
    session.extraCategories.length === 0 &&
    !hasBusinessData(session)
  ) {
    return actionError("Rien à importer : ajoutez au moins un bien.");
  }

  // ---- 1. Validation complète avant toute écriture -------------------
  for (const item of items) {
    for (const unit of expandItem(item)) {
      const check = equipmentSchema.safeParse(
        toEquipmentInput(item, unit.name, unit.quantity, null)
      );
      if (!check.success) {
        const first = check.error.issues[0];
        return actionError(
          `« ${item.name || "Bien sans nom"} » : ${first?.message ?? "données invalides"}`
        );
      }
    }
  }

  // ---- 2. Catégories : réutiliser l'existant, créer le manquant ------
  const existingCategories = await provider.categories.list();
  const categoryIdByKey = new Map(
    existingCategories.map((c) => [normalizeName(c.name), c.id])
  );
  const createdCategoryIds: string[] = [];
  let createdCategories = 0;

  const neededNames = new Map<string, string>();
  for (const label of session.extraCategories) {
    if (label.trim()) neededNames.set(normalizeName(label), label.trim());
  }
  for (const item of items) {
    const label = item.categoryName.trim() || FALLBACK_CATEGORY;
    neededNames.set(normalizeName(label), label);
  }

  const createdEquipmentIds: string[] = [];
  // Hors du try : le catch s'en sert pour un message de rollback honnête
  // (les remplacements déjà appliqués ne sont pas restaurés).
  let replacedItems = 0;

  const rollback = async () => {
    // Best-effort : on retire ce que cet import venait de créer.
    for (const id of createdEquipmentIds) {
      try {
        await provider.equipment.archive(id);
      } catch {
        // Ignoré : le rapport d'erreur signale l'incident.
      }
    }
    for (const id of createdCategoryIds) {
      try {
        await provider.categories.remove(id);
      } catch {
        // Une catégorie devenue utilisée ailleurs peut refuser la suppression.
      }
    }
  };

  try {
    for (const [key, label] of neededNames) {
      if (!categoryIdByKey.has(key)) {
        const created = await provider.categories.create(label);
        categoryIdByKey.set(key, created.id);
        createdCategoryIds.push(created.id);
        createdCategories += 1;
      }
    }

    // ---- 3. Biens ----------------------------------------------------
    let createdItems = 0;

    for (const item of items) {
      const label = item.categoryName.trim() || FALLBACK_CATEGORY;
      const categoryId = categoryIdByKey.get(normalizeName(label)) ?? null;

      if (item.duplicateOfId && item.duplicateResolution === "replace") {
        const updated = await provider.equipment.update(
          item.duplicateOfId,
          {
            name: item.name.trim(),
            categoryId,
            internalRef: item.internalRef,
            description: item.description,
            dailyPrice: item.dailyPrice ?? 0,
            depositAmount: item.depositAmount ?? 0,
            quantityTotal: item.quantity,
            minRentalDays: item.minRentalDays,
            status: "available",
            usageInstructions: "",
            internalNotes: item.internalNotes,
          }
        );
        if (!updated) throw new Error(`Bien à remplacer introuvable : ${item.name}`);
        replacedItems += 1;
        continue;
      }

      for (const unit of expandItem(item)) {
        const created = await provider.equipment.create({
          name: unit.name,
          categoryId,
          internalRef: item.internalRef,
          description: item.description,
          dailyPrice: item.dailyPrice ?? 0,
          depositAmount: item.depositAmount ?? 0,
          quantityTotal: unit.quantity,
          minRentalDays: item.minRentalDays,
          status: "available",
          usageInstructions: "",
          internalNotes: item.internalNotes,
        });
        createdEquipmentIds.push(created.id);
        createdItems += 1;
      }
    }

    // ---- 4. Entreprise + fin d'onboarding ---------------------------
    const businessUpdated = hasBusinessData(session);
    const patch: Partial<Organization> = {
      onboarding_completed_at: new Date().toISOString(),
    };
    const b = session.business;
    if (b.name?.trim()) patch.name = b.name.trim();
    if (b.phone?.trim()) patch.phone = b.phone.trim();
    if (b.email?.trim()) patch.email = b.email.trim();
    if (b.address?.trim()) patch.address = b.address.trim();
    await provider.organization.update(patch);

    return actionOk({
      createdCategories,
      createdItems,
      replacedItems,
      skippedItems,
      businessUpdated,
    });
  } catch (error) {
    await rollback();
    const message =
      error instanceof Error ? error.message : "Erreur inattendue pendant l'import";
    const kept =
      replacedItems > 0
        ? ` (${replacedItems} remplacement${replacedItems > 1 ? "s" : ""} déjà ` +
          "appliqué(s) et conservé(s))"
        : "";
    return actionError(
      `Import annulé, les créations ont été retirées${kept} : ${message}`
    );
  }
}

function hasBusinessData(session: ImportSessionData): boolean {
  // Uniquement les champs réellement persistés sur l'organisation
  // (description et deliveryNotes n'ont pas de colonne : les compter
  // afficherait « entreprise mise à jour » sans aucune écriture).
  const b = session.business;
  return Boolean(
    b.name?.trim() || b.phone?.trim() || b.email?.trim() || b.address?.trim()
  );
}
