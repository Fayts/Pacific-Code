// Service Matériel — validation et règles métier côté client :
// les composants n'appellent jamais le repository directement pour
// écrire. Le repository sous-jacent (mock aujourd'hui, Supabase demain)
// ne fait que persister.

import { getDataProvider } from "@/lib/data";
import type { DataProvider, EquipmentDraft } from "@/lib/data/repositories";
import {
  categorySchema,
  equipmentSchema,
  type CategoryInput,
  type EquipmentInput,
} from "@/lib/validations/equipment";
import {
  actionError,
  actionOk,
  zodError,
  type ActionResult,
} from "@/server/action-result";
import type { EquipmentStatus } from "@/lib/types/database";

/** Statuts modifiables manuellement (réservé/loué sont dérivés, archivé à part). */
const MANUAL_STATUSES: EquipmentStatus[] = [
  "available",
  "maintenance",
  "unavailable",
];

function toDraft(values: EquipmentInput): EquipmentDraft {
  return {
    name: values.name,
    categoryId: values.categoryId ?? null,
    internalRef: values.internalRef ?? "",
    description: values.description ?? "",
    dailyPrice: values.dailyPrice,
    depositAmount: values.depositAmount,
    quantityTotal: values.quantityTotal,
    minRentalDays: values.minRentalDays,
    status: values.status,
    usageInstructions: values.usageInstructions ?? "",
    internalNotes: values.internalNotes ?? "",
  };
}

export async function createEquipment(
  input: EquipmentInput,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<{ equipmentId: string }>> {
  const parsed = equipmentSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const item = await provider.equipment.create(toDraft(parsed.data));
  return actionOk({ equipmentId: item.id });
}

export async function updateEquipment(
  id: string,
  input: EquipmentInput,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<{ equipmentId: string }>> {
  const parsed = equipmentSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const item = await provider.equipment.update(id, toDraft(parsed.data));
  if (!item) return actionError("Matériel introuvable");
  return actionOk({ equipmentId: item.id });
}

export async function setEquipmentStatus(
  equipmentId: string,
  status: EquipmentStatus,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  if (!MANUAL_STATUSES.includes(status)) {
    return actionError("Statut invalide");
  }
  const item = await provider.equipment.get(equipmentId);
  if (!item) return actionError("Matériel introuvable");

  await provider.equipment.setStatus(equipmentId, status);
  return actionOk(undefined);
}

export async function archiveEquipment(
  id: string,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const result = await provider.equipment.archive(id);
  if (!result.ok) {
    return actionError(result.error ?? "Impossible d'archiver ce matériel");
  }
  return actionOk(undefined);
}

export async function unarchiveEquipment(
  id: string,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const item = await provider.equipment.get(id);
  if (!item) return actionError("Matériel introuvable");

  await provider.equipment.unarchive(id);
  return actionOk(undefined);
}

export async function duplicateEquipment(
  id: string,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<{ equipmentId: string }>> {
  const copy = await provider.equipment.duplicate(id);
  if (!copy) return actionError("Matériel introuvable");
  return actionOk({ equipmentId: copy.id });
}

export async function createCategory(
  input: CategoryInput,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<{ categoryId: string; name: string }>> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const category = await provider.categories.create(
    parsed.data.name,
    parsed.data.description || undefined
  );
  return actionOk({ categoryId: category.id, name: category.name });
}
