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
import { isBlockingStatus } from "@/lib/core/booking-status";
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
    pricingMode: values.pricingMode,
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

/**
 * Nombre d'exemplaires qu'il est impossible de retirer du parc : pic de
 * réservations bloquantes à venir + exemplaires actuellement sortis
 * (y compris en retard). Balayage d'événements sur [now, ∞), fin exclusive.
 */
async function reservedFloor(
  equipmentId: string,
  provider: DataProvider
): Promise<number> {
  const nowIso = new Date().toISOString();
  const bookings = await provider.bookings.list();

  let out = 0;
  const events: { at: string; delta: number }[] = [];
  for (const booking of bookings) {
    if (!isBlockingStatus(booking.status)) continue;
    for (const item of booking.items) {
      if (item.equipment_id !== equipmentId) continue;
      if (booking.status === "in_progress") out += item.quantity;
      if (booking.end_at > nowIso) {
        events.push({
          at: booking.start_at > nowIso ? booking.start_at : nowIso,
          delta: item.quantity,
        });
        events.push({ at: booking.end_at, delta: -item.quantity });
      }
    }
  }
  events.sort((a, b) =>
    a.at === b.at ? a.delta - b.delta : a.at.localeCompare(b.at)
  );
  let running = 0;
  let peak = 0;
  for (const event of events) {
    running += event.delta;
    if (running > peak) peak = running;
  }
  return Math.max(peak, out);
}

export async function updateEquipment(
  id: string,
  input: EquipmentInput,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<{ equipmentId: string }>> {
  const parsed = equipmentSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  // Réduire le parc sous les quantités déjà réservées ou sorties créerait
  // une sur-réservation silencieuse : on bloque avec un message explicite.
  const floor = await reservedFloor(id, provider);
  if (parsed.data.quantityTotal < floor) {
    return actionError(
      `Impossible de réduire la quantité à ${parsed.data.quantityTotal} : ` +
        `${floor} exemplaire${floor > 1 ? "s sont" : " est"} déjà réservé(s) ` +
        "ou en location. Annulez d'abord les réservations concernées."
    );
  }

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
